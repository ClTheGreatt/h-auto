import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { PlotStatus, UserRole } from "@prisma/client";
import {
  buildSectionStudentsWhere,
  classifySectionStudents,
  finalSectionAssignmentCounts,
  sectionAssignmentAccessError,
  sectionAssignmentInputError,
  sectionAssignmentRows,
} from "./section-assignment";

// These are pure policy/shape checks. They do not claim to prove the
// PostgreSQL index or concurrent transaction behavior without a safe DB.
const target = { plotId: "plot-a", course: "BS Agriculture - Crop Science", section: "BSA-4D" };

test("Faculty own plot and advised section is allowed; wrong section/plot is denied", () => {
  const base = { role: "FACULTY" as UserRole, actorId: "faculty-a", plotFacultyId: "faculty-a", plotStatus: "GROWING" as PlotStatus, sectionAuthorized: true };
  assert.equal(sectionAssignmentAccessError(base), null);
  assert.match(sectionAssignmentAccessError({ ...base, sectionAuthorized: false })!, /section/);
  assert.match(sectionAssignmentAccessError({ ...base, plotFacultyId: "faculty-b" })!, /adviser/);
});

test("Admin and Super Admin have broader scope; Student Farmer is denied", () => {
  for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
    assert.equal(sectionAssignmentAccessError({ role, actorId: role, plotFacultyId: "faculty-a", plotStatus: "PREPARING", sectionAuthorized: true }), null);
  }
  assert.match(sectionAssignmentAccessError({ role: "STUDENT_FARMER", actorId: "student", plotFacultyId: "faculty-a", plotStatus: "PREPARING", sectionAuthorized: true })!, /not authorized/);
});

test("Canonical activity statuses are accepted; historical statuses are rejected", () => {
  for (const plotStatus of ["PREPARING", "PLANTED", "GROWING", "READY_FOR_HARVEST"] as const) {
    assert.equal(sectionAssignmentAccessError({ role: "ADMIN", actorId: "admin", plotFacultyId: "faculty", plotStatus, sectionAuthorized: true }), null);
  }
  for (const plotStatus of ["HARVESTED", "FALLOW", "ARCHIVED"] as const) {
    assert.match(sectionAssignmentAccessError({ role: "ADMIN", actorId: "admin", plotFacultyId: "faculty", plotStatus, sectionAuthorized: true })!, /preparing or operational/);
  }
});

test("Eligibility predicate includes exact course/section and canonical active non-graduated role", () => {
  assert.deepEqual(buildSectionStudentsWhere(target), {
    role: "STUDENT_FARMER", status: "ACTIVE", graduatedAt: null,
    course: target.course, section: target.section,
  });
  assert.deepEqual(buildSectionStudentsWhere({ ...target, course: null }).course, null);
  assert.equal(sectionAssignmentInputError({ ...target, course: "" }), "Select a valid course.");
});

test("Same-named sections in different courses and null-course cohorts stay distinct", () => {
  const courseA = buildSectionStudentsWhere({
    ...target,
    course: "BS Agriculture - Crop Science",
  });
  const courseB = buildSectionStudentsWhere({
    ...target,
    course: "BS Agriculture - Agronomy",
  });
  const noCourse = buildSectionStudentsWhere({ ...target, course: null });

  assert.deepEqual(courseA.course, "BS Agriculture - Crop Science");
  assert.deepEqual(courseB.course, "BS Agriculture - Agronomy");
  assert.deepEqual(noCourse.course, null);
  assert.equal(courseA.section, target.section);
  assert.equal(courseB.section, target.section);
  assert.notDeepEqual(courseA, courseB);
  assert.notDeepEqual(courseA, noCourse);
});

test("Candidate lookup input requires plot, an explicit valid course value, and section", () => {
  assert.equal(
    sectionAssignmentInputError({ ...target, plotId: "" }),
    "Select a plot, course, and section."
  );
  assert.equal(
    sectionAssignmentInputError({ ...target, section: "" }),
    "Select a plot, course, and section."
  );
  assert.equal(sectionAssignmentInputError({ ...target, course: null }), null);
});

test("Selected-plot active IDs alone are excluded; another-plot assignments do not matter", () => {
  const result = classifySectionStudents(["student-a", "student-b", "student-c"], ["student-b"]);
  assert.deepEqual(result.missingIds, ["student-a", "student-c"]);
  assert.deepEqual(result.counts, { eligibleStudents: 3, alreadyAssigned: 1, willBeAssigned: 2 });
});

test("20 eligible, partial existing, and all existing return actual server counts", () => {
  const ids = Array.from({ length: 20 }, (_, n) => `student-${n}`);
  assert.equal(classifySectionStudents(ids, []).missingIds.length, 20);
  assert.equal(classifySectionStudents(ids, ids.slice(0, 5)).missingIds.length, 15);
  assert.deepEqual(classifySectionStudents(ids, ids).counts, { eligibleStudents: 20, alreadyAssigned: 20, willBeAssigned: 0 });
  assert.deepEqual(finalSectionAssignmentCounts(20, 14), { eligibleStudents: 20, created: 14, alreadyAssigned: 6 });
});

test("Shared notes and actor/adviser IDs are copied to each ordinary ACTIVE row", () => {
  assert.deepEqual(sectionAssignmentRows(["a", "b"], { plotId: "plot", facultyId: "adviser", assignedById: "admin", notes: "Water daily" }), [
    { plotId: "plot", studentId: "a", facultyId: "adviser", assignedById: "admin", status: "ACTIVE", notes: "Water daily" },
    { plotId: "plot", studentId: "b", facultyId: "adviser", assignedById: "admin", status: "ACTIVE", notes: "Water daily" },
  ]);
  assert.deepEqual(sectionAssignmentRows([], { plotId: "plot", facultyId: "adviser", assignedById: "admin" }), []);
});

test("Raw SQL migration has fail-first duplicate preflight and ACTIVE-only partial index", () => {
  const sql = readFileSync("prisma/migrations/20260916090000_active_plot_student_assignment_unique/migration.sql", "utf8");
  const preflight = sql.indexOf("HAVING COUNT(*) > 1");
  const index = sql.indexOf("CREATE UNIQUE INDEX");
  assert.ok(preflight >= 0 && preflight < index);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.match(sql, /CREATE UNIQUE INDEX "PlotAssignment_active_plot_student_unique"\s+ON "PlotAssignment" \("plotId", "studentId"\)\s+WHERE "status" = 'ACTIVE'/);
  assert.doesNotMatch(sql, /DELETE FROM|UPDATE "PlotAssignment"/);
});

test("Active-pair fixture policy preserves history and cross-plot assignments", () => {
  type Row = { plotId: string; studentId: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED" };
  function duplicateActivePair(rows: Row[]) {
    const seen = new Set<string>();
    for (const row of rows.filter((candidate) => candidate.status === "ACTIVE")) {
      const key = JSON.stringify([row.plotId, row.studentId]);
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  }
  const active: Row = { plotId: "plot-a", studentId: "student-a", status: "ACTIVE" };
  assert.equal(duplicateActivePair([active]), false);
  assert.equal(duplicateActivePair([active, { ...active }]), true);
  assert.equal(duplicateActivePair([active, { ...active, status: "COMPLETED" }]), false);
  assert.equal(duplicateActivePair([active, { ...active, plotId: "plot-b" }]), false);
  assert.equal(duplicateActivePair([active, { ...active, studentId: "student-b" }]), false);
});
