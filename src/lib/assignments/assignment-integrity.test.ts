import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlotStatus, UserRole, UserStatus } from "@prisma/client";
import {
  type AssignmentIntegrityClient,
  validateFinalAssignment,
} from "./assignment-integrity";

const COURSE = "BS Agriculture - Crop Science";
const SECTION = "BSA-4A";

type Scenario = {
  plot: { facultyId: string | null; status: PlotStatus } | null;
  student: {
    id: string;
    role: UserRole;
    status: UserStatus;
    graduatedAt: Date | null;
    course: string | null;
    section: string | null;
  } | null;
  faculty: {
    id: string;
    role: UserRole;
    status: UserStatus;
    department: string | null;
    advisories: { course: string | null; section: string }[];
  } | null;
  duplicate: boolean;
};

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    plot: { facultyId: "faculty-a", status: "GROWING" },
    student: {
      id: "student-a",
      role: "STUDENT_FARMER",
      status: "ACTIVE",
      graduatedAt: null,
      course: COURSE,
      section: SECTION,
    },
    faculty: {
      id: "faculty-a",
      role: "FACULTY",
      status: "ACTIVE",
      department: COURSE,
      advisories: [{ course: COURSE, section: SECTION }],
    },
    duplicate: false,
    ...overrides,
  };
}

function clientFor(state: Scenario): AssignmentIntegrityClient {
  return {
    plot: {
      findUnique: async () => state.plot,
    },
    user: {
      findUnique: async () => state.student,
      findFirst: async (args: { where: Record<string, unknown> }) => {
        const faculty = state.faculty;
        if (!faculty) return null;
        const where = args.where as {
          id: string;
          role: UserRole;
          status: UserStatus;
          department: string;
          advisories: { some: { course: string; section: string } };
        };
        const cohort = where.advisories.some;
        const matches =
          faculty.id === where.id &&
          faculty.role === where.role &&
          faculty.status === where.status &&
          faculty.department === where.department &&
          faculty.advisories.some(
            (advisory) =>
              advisory.course === cohort.course &&
              advisory.section === cohort.section
          );
        return matches ? { id: faculty.id } : null;
      },
    },
    plotAssignment: {
      findFirst: async () => (state.duplicate ? { id: "assignment-a" } : null),
    },
  } as unknown as AssignmentIntegrityClient;
}

async function validate(
  state: Scenario,
  actor: { role: UserRole; id: string }
) {
  return validateFinalAssignment(
    { actor, plotId: "plot-a", studentId: "student-a" },
    clientFor(state)
  );
}

test("active Student with matching target adviser is allowed", async () => {
  const result = await validate(scenario(), { role: "FACULTY", id: "faculty-a" });
  assert.equal(result.ok, true);
});

test("inactive Student is rejected by final validation", async () => {
  const state = scenario({
    student: { ...scenario().student!, status: "INACTIVE" },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "STUDENT_INACTIVE");
});

test("graduated Student is rejected by final validation", async () => {
  const state = scenario({
    student: {
      ...scenario().student!,
      graduatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "STUDENT_GRADUATED");
});

test("non-Student role is rejected by final validation", async () => {
  const state = scenario({
    student: { ...scenario().student!, role: "FACULTY" },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "STUDENT_ROLE_INVALID");
});

test("Admin actor with matching target adviser is allowed", async () => {
  const result = await validate(scenario(), { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, true);
});

test("Admin actor cannot assign to an inactive matching target adviser", async () => {
  const state = scenario({
    faculty: { ...scenario().faculty!, status: "INACTIVE" },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "TARGET_ADVISER_COHORT_INVALID");
    assert.equal(
      result.error,
      "The plot adviser is not currently eligible for the selected course and section."
    );
  }
});

test("Super Admin actor with matching active target adviser is allowed", async () => {
  const result = await validate(scenario(), {
    role: "SUPER_ADMIN",
    id: "root-a",
  });
  assert.equal(result.ok, true);
});

test("Admin actor cannot bypass a mismatched target adviser", async () => {
  const state = scenario({
    faculty: { ...scenario().faculty!, advisories: [] },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TARGET_ADVISER_COHORT_INVALID");
});

test("Super Admin cannot bypass a mismatched target adviser", async () => {
  const state = scenario({
    faculty: { ...scenario().faculty!, department: "BTVTEd - Animal Production" },
  });
  const result = await validate(state, { role: "SUPER_ADMIN", id: "root-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TARGET_ADVISER_COHORT_INVALID");
});

test("Faculty actor on their own exact cohort remains allowed", async () => {
  const result = await validate(scenario(), { role: "FACULTY", id: "faculty-a" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plot.facultyId, "faculty-a");
});

test("Faculty actor on their own plot but wrong cohort is rejected", async () => {
  const state = scenario({
    student: {
      ...scenario().student!,
      course: "BTVTEd - Animal Production",
      section: "BTVTED-4B",
    },
  });
  const result = await validate(state, { role: "FACULTY", id: "faculty-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "ACTOR_COHORT_FORBIDDEN");
});

test("duplicate ACTIVE assignment remains rejected", async () => {
  const result = await validate(scenario({ duplicate: true }), {
    role: "ADMIN",
    id: "admin-a",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "DUPLICATE_ACTIVE_ASSIGNMENT");
});

test("current Plot.facultyId remains the authoritative stored adviser", async () => {
  const state = scenario({
    plot: { facultyId: "faculty-current", status: "GROWING" },
    faculty: { ...scenario().faculty!, id: "faculty-current" },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plot.facultyId, "faculty-current");
});

test("non-Faculty target adviser is rejected by canonical cohort authority", async () => {
  const state = scenario({
    faculty: { ...scenario().faculty!, role: "ADMIN" },
  });
  const result = await validate(state, { role: "ADMIN", id: "admin-a" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TARGET_ADVISER_COHORT_INVALID");
});
