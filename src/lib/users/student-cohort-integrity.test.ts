import assert from "node:assert/strict";
import { test } from "node:test";
import type { UserRole, UserStatus } from "@prisma/client";
import { validateStudentAcademicUpdate } from "@/lib/validations/user";
import {
  applyUserUpdateWithStudentAssignmentLifecycle,
  type StudentAssignmentLifecycleClient,
} from "./student-assignment-lifecycle";
import {
  ACTIVE_ASSIGNMENT_STUDENT_COHORT_ERROR,
  applyUserUpdateWithStudentCohortIntegrity,
  canonicalStudentCohortValues,
  type StudentCohortIntegrityClient,
  validateStudentCohortMutation,
} from "./student-cohort-integrity";

const COURSE = "BS Agriculture - Crop Science";
const OTHER_COURSE = "BTVTEd - Animal Production";
const TRANSITION_AT = new Date("2026-09-18T09:00:00.000Z");

type Assignment = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  endedAt: Date | null;
};

type QueryCounts = { activeLookups: number; userUpdates: number };

function state(overrides: {
  role?: UserRole;
  status?: UserStatus;
  course?: string | null;
  section?: string | null;
} = {}) {
  return {
    id: "student-a",
    role: "STUDENT_FARMER" as UserRole,
    status: "ACTIVE" as UserStatus,
    course: COURSE,
    section: "BSA-4A",
    ...overrides,
  };
}

function assignment(
  id: string,
  status: Assignment["status"] = "ACTIVE"
): Assignment {
  return { id, status, endedAt: status === "ACTIVE" ? null : TRANSITION_AT };
}

function clientFor(
  assignments: Assignment[],
  counts: QueryCounts = { activeLookups: 0, userUpdates: 0 }
): StudentCohortIntegrityClient & StudentAssignmentLifecycleClient {
  return {
    plotAssignment: {
      findFirst: async (args: { where: { status: Assignment["status"] } }) => {
        counts.activeLookups += 1;
        const row = assignments.find(
          (candidate) => candidate.status === args.where.status
        );
        return row ? { id: row.id } : null;
      },
      updateMany: async (args: {
        where: { status: Assignment["status"] };
        data: Pick<Assignment, "status" | "endedAt">;
      }) => {
        let count = 0;
        for (const row of assignments) {
          if (row.status === args.where.status) {
            row.status = args.data.status;
            row.endedAt = args.data.endedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
  } as unknown as StudentCohortIntegrityClient &
    StudentAssignmentLifecycleClient;
}

test("ACTIVE assignment rejects a course change without updating User", async () => {
  const rows = [assignment("active")];
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    {
      current,
      next: { ...current, course: OTHER_COURSE, section: "BTVTED-4A" },
    },
    clientFor(rows, counts),
    async () => {
      counts.userUpdates += 1;
    }
  );
  assert.deepEqual(result, {
    ok: false,
    error: ACTIVE_ASSIGNMENT_STUDENT_COHORT_ERROR,
  });
  assert.equal(counts.userUpdates, 0);
});

test("ACTIVE assignment rejects an exact section change", async () => {
  const current = state();
  const result = await validateStudentCohortMutation(
    current,
    { ...current, section: "BSA-4D" },
    clientFor([assignment("active")])
  );
  assert.equal(result.ok, false);
});

test("multiple ACTIVE assignments still reject one cohort change", async () => {
  const current = state();
  const result = await validateStudentCohortMutation(
    current,
    { ...current, course: OTHER_COURSE, section: "BTVTED-4A" },
    clientFor([assignment("one"), assignment("two")])
  );
  assert.deepEqual(result, {
    ok: false,
    error: ACTIVE_ASSIGNMENT_STUDENT_COHORT_ERROR,
  });
});

test("only COMPLETED assignments allow a cohort change", async () => {
  const current = state();
  const result = await validateStudentCohortMutation(
    current,
    { ...current, section: "BSA-4D" },
    clientFor([assignment("history", "COMPLETED")])
  );
  assert.deepEqual(result, { ok: true });
});

test("zero assignments allow a cohort change", async () => {
  const current = state();
  const result = await validateStudentCohortMutation(
    current,
    { ...current, section: "BSA-4D" },
    clientFor([])
  );
  assert.deepEqual(result, { ok: true });
});

test("name-only edit with ACTIVE assignment skips the cohort query", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const result = await validateStudentCohortMutation(
    current,
    current,
    clientFor([assignment("active")], counts)
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(counts.activeLookups, 0);
});

test("phone-only edit with ACTIVE assignment skips the cohort query", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const result = await validateStudentCohortMutation(
    current,
    { ...current },
    clientFor([assignment("active")], counts)
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(counts.activeLookups, 0);
});

test("existing mismatched ACTIVE assignment does not block an unrelated edit", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: current },
    clientFor([assignment("legacy-mismatch")], counts),
    async () => {
      counts.userUpdates += 1;
      return "updated";
    }
  );
  assert.deepEqual(result, { ok: true, value: "updated" });
  assert.equal(counts.activeLookups, 0);
  assert.equal(counts.userUpdates, 1);
});

test("deactivation takes precedence and completes ACTIVE assignments atomically", async () => {
  const rows = [assignment("active")];
  const counts = { activeLookups: 0, userUpdates: 0 };
  const client = clientFor(rows, counts);
  const current = state();
  const next = {
    ...current,
    status: "INACTIVE" as const,
    course: OTHER_COURSE,
    section: "BTVTED-4A",
  };
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next },
    client,
    () =>
      applyUserUpdateWithStudentAssignmentLifecycle(
        { current, next, transitionAt: TRANSITION_AT },
        client,
        async () => {
          counts.userUpdates += 1;
          return "updated";
        }
      )
  );
  assert.equal(result.ok, true);
  assert.equal(counts.activeLookups, 0);
  assert.equal(counts.userUpdates, 1);
  assert.equal(rows[0].status, "COMPLETED");
});

test("Student role exit takes precedence and completes ACTIVE assignments", async () => {
  const rows = [assignment("active")];
  const counts = { activeLookups: 0, userUpdates: 0 };
  const client = clientFor(rows, counts);
  const current = state();
  const next = {
    ...current,
    role: "FACULTY" as const,
    course: null,
    section: null,
  };
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next },
    client,
    () =>
      applyUserUpdateWithStudentAssignmentLifecycle(
        { current, next, transitionAt: TRANSITION_AT },
        client,
        async () => {
          counts.userUpdates += 1;
          return "updated";
        }
      )
  );
  assert.equal(result.ok, true);
  assert.equal(counts.activeLookups, 0);
  assert.equal(counts.userUpdates, 1);
  assert.equal(rows[0].status, "COMPLETED");
});

test("whitespace-only section submission stays unchanged and persists canonically", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const finalCohort = canonicalStudentCohortValues({
    course: COURSE,
    section: " BSA-4A ",
  });
  let persistedSection: string | null = null;
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: { ...current, ...finalCohort } },
    clientFor([assignment("active")], counts),
    async () => {
      counts.userUpdates += 1;
      persistedSection = finalCohort.section;
    }
  );
  assert.equal(result.ok, true);
  assert.equal(counts.activeLookups, 0);
  assert.equal(counts.userUpdates, 1);
  assert.equal(persistedSection, "BSA-4A");
});

test("permitted section casing and spacing persist in canonical uppercase", async () => {
  const current = state();
  const finalCohort = canonicalStudentCohortValues({
    course: COURSE,
    section: " bsa-4a ",
  });
  let persisted = finalCohort;
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: { ...current, ...finalCohort } },
    clientFor([assignment("active")]),
    async () => {
      persisted = finalCohort;
    }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(persisted, { course: COURSE, section: "BSA-4A" });
});

test("whitespace-padded canonical Course stays unchanged and persists canonically", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const finalCohort = canonicalStudentCohortValues({
    course: ` ${COURSE} `,
    section: current.section,
  });
  let persistedCourse: string | null = null;
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: { ...current, ...finalCohort } },
    clientFor([assignment("active")], counts),
    async () => {
      counts.userUpdates += 1;
      persistedCourse = finalCohort.course;
    }
  );
  assert.equal(result.ok, true);
  assert.equal(counts.activeLookups, 0);
  assert.equal(persistedCourse, COURSE);
});

test("real canonical section change with ACTIVE assignment rejects before persistence", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const finalCohort = canonicalStudentCohortValues({
    course: COURSE,
    section: " bsa-4d ",
  });
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: { ...current, ...finalCohort } },
    clientFor([assignment("active")], counts),
    async () => {
      counts.userUpdates += 1;
    }
  );
  assert.deepEqual(result, {
    ok: false,
    error: ACTIVE_ASSIGNMENT_STUDENT_COHORT_ERROR,
  });
  assert.equal(finalCohort.section, "BSA-4D");
  assert.equal(counts.userUpdates, 0);
});

test("real section change without ACTIVE assignments persists canonically", async () => {
  const current = state();
  const finalCohort = canonicalStudentCohortValues({
    course: COURSE,
    section: " bsa-4d ",
  });
  let persistedSection: string | null = null;
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: { ...current, ...finalCohort } },
    clientFor([]),
    async () => {
      persistedSection = finalCohort.section;
    }
  );
  assert.equal(result.ok, true);
  assert.equal(persistedSection, "BSA-4D");
});

test("unrelated edit with ACTIVE assignment keeps padded cohort identity canonical", async () => {
  const counts = { activeLookups: 0, userUpdates: 0 };
  const current = state();
  const finalCohort = canonicalStudentCohortValues({
    course: ` ${COURSE} `,
    section: " bsa-4a ",
  });
  let persisted: typeof finalCohort | null = null;
  const result = await applyUserUpdateWithStudentCohortIntegrity(
    { current, next: { ...current, ...finalCohort } },
    clientFor([assignment("active")], counts),
    async () => {
      counts.userUpdates += 1;
      persisted = finalCohort;
      return { firstName: "Updated", phoneNumber: "09171234567" };
    }
  );
  assert.equal(result.ok, true);
  assert.equal(counts.activeLookups, 0);
  assert.equal(counts.userUpdates, 1);
  assert.deepEqual(persisted, { course: COURSE, section: "BSA-4A" });
});

test("academic change detection compares canonical current and final cohort values", () => {
  const existing = {
    role: "STUDENT_FARMER" as const,
    idNumber: "23-00001",
    academicYear: "2023-2024",
    course: COURSE,
    yearLevel: "4th Year",
    section: " bsa-4a ",
  };
  const currentAcademicInput = {
    ...existing,
    ...canonicalStudentCohortValues(existing),
  };
  const finalCohort = canonicalStudentCohortValues({
    course: ` ${COURSE} `,
    section: " BSA-4A ",
  });
  const result = validateStudentAcademicUpdate(currentAcademicInput, {
    ...existing,
    ...finalCohort,
  });
  assert.equal(result.changed, false);
  assert.deepEqual(result.issues, []);
});

test("Course canonicalization trims but does not accept noncanonical casing", () => {
  const existing = {
    role: "STUDENT_FARMER" as const,
    idNumber: "23-00001",
    academicYear: "2023-2024",
    course: COURSE,
    yearLevel: "4th Year",
    section: "BSA-4A",
  };
  const finalCohort = canonicalStudentCohortValues({
    course: COURSE.toLowerCase(),
    section: existing.section,
  });
  const result = validateStudentAcademicUpdate(existing, {
    ...existing,
    ...finalCohort,
  });
  assert.equal(result.changed, true);
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_COURSE"));
});
