import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

const assignments = source("src", "actions", "assignments.ts");
const assignStudentBody = assignments.slice(
  assignments.indexOf("export async function assignStudent"),
  assignments.indexOf("export async function removeAssignment")
);
const candidateBody = assignments.slice(
  assignments.indexOf("export async function getAssignableStudentsForPlot"),
  assignments.indexOf("async function validateSectionTarget")
);
const bulkBody = assignments.slice(
  assignments.indexOf("async function validateSectionTarget")
);

test("individual assignment authorizes the actual Student Course and Section", () => {
  assert.match(
    assignStudentBody,
    /assertFacultyCanAssignStudent\([\s\S]*?student\?\.course \?\? null,[\s\S]*?student\?\.section \?\? null/
  );
});

test("candidate lookup authorizes the requested exact Course and Section", () => {
  assert.match(
    candidateBody,
    /assertFacultyCanAssignStudent\([\s\S]*?target\.course,[\s\S]*?target\.section/
  );
});

test("bulk preview uses the shared exact target validator", () => {
  assert.match(
    bulkBody,
    /getSectionAssignmentPreview[\s\S]*?validateSectionTarget\([\s\S]*?target,[\s\S]*?prisma/
  );
});

test("bulk submit rechecks the exact target inside the serializable transaction", () => {
  assert.match(
    bulkBody,
    /assignSectionToPlot[\s\S]*?\$transaction\(async \(tx\)[\s\S]*?validateSectionTarget\(target, actor, tx\)/
  );
  assert.match(
    bulkBody,
    /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/
  );
});

test("Assignments and Plot Detail use the shared actor-scoped cohort source", () => {
  const assignmentsPage = source(
    "src",
    "app",
    "dashboard",
    "assignments",
    "page.tsx"
  );
  const plotDetailPage = source(
    "src",
    "app",
    "dashboard",
    "plots",
    "[id]",
    "page.tsx"
  );
  assert.match(assignmentsPage, /getAssignableStudentCohorts\(actor\)/);
  assert.match(plotDetailPage, /getAssignableStudentCohorts\(\{ role, userId:/);
});

test("mobile assignment and candidate routes share the exact cohort policy", () => {
  const mobileAssignment = source(
    "src",
    "app",
    "api",
    "mobile",
    "me",
    "plots",
    "[id]",
    "assignments",
    "route.ts"
  );
  const mobileCandidates = source(
    "src",
    "app",
    "api",
    "mobile",
    "me",
    "plots",
    "[id]",
    "assignable-students",
    "route.ts"
  );
  assert.match(
    mobileAssignment,
    /assertFacultyCanAssignStudent\([\s\S]*?student\.course,[\s\S]*?student\.section/
  );
  assert.match(mobileCandidates, /buildAssignableStudentsWhere\(\{/);
});

test("legacy advisory presentation stays visible and explicitly reviewable", () => {
  const component = source(
    "src",
    "components",
    "users",
    "faculty-advisories.tsx"
  );
  assert.match(component, /Course not recorded/);
  assert.match(component, /Needs review/);
  assert.match(component, /isAdvisoryResolvedForDepartment\(department, advisory\)/);
  assert.match(component, /removeReviewIds/);
  assert.match(component, /advisory\.course \?\? "Course not recorded"/);
});

test("user updates validate the resulting Faculty role without deleting advisories", () => {
  const usersAction = source("src", "actions", "users.ts");
  assert.match(usersAction, /resultingUserAcademicState\(existingUser,/);
  assert.match(
    usersAction,
    /if \(resultingAcademicState\.role === "FACULTY"\)/
  );
  assert.match(usersAction, /resultingFacultyAdvisoryError\(/);
  assert.doesNotMatch(usersAction, /facultySectionAdvisory\.delete/);
});

test("section-only Faculty authorization helper is absent", () => {
  const authorizationSources = [
    source("src", "lib", "auth", "section-access.ts"),
    assignments,
    source(
      "src",
      "app",
      "api",
      "mobile",
      "me",
      "plots",
      "[id]",
      "assignments",
      "route.ts"
    ),
  ].join("\n");
  assert.doesNotMatch(authorizationSources, /canFacultyAdviseSection/);
});
