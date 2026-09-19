import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  PlotStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import {
  ACTIVE_ASSIGNMENTS_REQUIRE_ADVISER_ERROR,
  applyPlotActivityEntryWithIntegrity,
  applyPlotUpdateWithAdviserIntegrity,
  INCOMPATIBLE_PLOT_ADVISER_ERROR,
  INELIGIBLE_ACTIVITY_ENTRY_ADVISER_ERROR,
  type PlotAdviserIntegrityClient,
  validatePlotActivityEntry,
} from "./adviser-integrity";

const COURSE = "BS Agriculture - Crop Science";

type Faculty = {
  id: string;
  role: UserRole;
  status: UserStatus;
  department: string | null;
  advisories: { course: string | null; section: string }[];
};

type Scenario = {
  plot: { facultyId: string | null; status: PlotStatus };
  assignments: {
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    course: string | null;
    section: string | null;
  }[];
  faculty: Faculty | null;
};

function faculty(overrides: Partial<Faculty> = {}): Faculty {
  return {
    id: "faculty-a",
    role: "FACULTY",
    status: "ACTIVE",
    department: COURSE,
    advisories: [],
    ...overrides,
  };
}

function activeAssignment(section: string) {
  return { status: "ACTIVE" as const, course: COURSE, section };
}

function clientFor(scenario: Scenario): PlotAdviserIntegrityClient {
  return {
    plot: {
      findUnique: async () => ({ ...scenario.plot }),
    },
    plotAssignment: {
      findMany: async (args: { where: { status: string } }) =>
        scenario.assignments
          .filter((row) => row.status === args.where.status)
          .map((row) => ({
            student: { course: row.course, section: row.section },
          })),
    },
    user: {
      findUnique: async (args: { where: { id: string } }) => {
        const adviser = scenario.faculty;
        return adviser && adviser.id === args.where.id
          ? { role: adviser.role, status: adviser.status }
          : null;
      },
      findFirst: async (args: {
        where: {
          id: string;
          role: UserRole;
          status: UserStatus;
          department: string;
          advisories: { some: { course: string; section: string } };
        };
      }) => {
        const adviser = scenario.faculty;
        const where = args.where;
        const cohort = where.advisories.some;
        const matches =
          adviser?.id === where.id &&
          adviser.role === where.role &&
          adviser.status === where.status &&
          adviser.department === where.department &&
          adviser.advisories.some(
            (row) =>
              row.course === cohort.course && row.section === cohort.section
          );
        return matches ? { id: adviser.id } : null;
      },
    },
  } as unknown as PlotAdviserIntegrityClient;
}

async function validate(
  scenario: Scenario,
  resultingStatus: PlotStatus
) {
  return validatePlotActivityEntry(
    { plotId: "plot-a", resultingStatus },
    clientFor(scenario)
  );
}

test("ARCHIVED with retained active Faculty can enter PREPARING", async () => {
  const result = await validate(
    {
      plot: { facultyId: "faculty-a", status: "ARCHIVED" },
      assignments: [],
      faculty: faculty(),
    },
    "PREPARING"
  );
  assert.deepEqual(result, { ok: true });
});

test("ARCHIVED with retained inactive Faculty cannot enter PREPARING", async () => {
  const result = await validate(
    {
      plot: { facultyId: "faculty-a", status: "ARCHIVED" },
      assignments: [],
      faculty: faculty({ status: "INACTIVE" }),
    },
    "PREPARING"
  );
  assert.deepEqual(result, {
    ok: false,
    error: INELIGIBLE_ACTIVITY_ENTRY_ADVISER_ERROR,
  });
});

test("ARCHIVED with retained non-Faculty adviser cannot re-enter activity", async () => {
  const result = await validate(
    {
      plot: { facultyId: "faculty-a", status: "ARCHIVED" },
      assignments: [],
      faculty: faculty({ role: "ADMIN" }),
    },
    "PREPARING"
  );
  assert.deepEqual(result, {
    ok: false,
    error: INELIGIBLE_ACTIVITY_ENTRY_ADVISER_ERROR,
  });
});

test("HARVESTED with retained inactive Faculty cannot enter GROWING", async () => {
  const result = await validate(
    {
      plot: { facultyId: "faculty-a", status: "HARVESTED" },
      assignments: [],
      faculty: faculty({ status: "INACTIVE" }),
    },
    "GROWING"
  );
  assert.equal(result.ok, false);
});

test("FALLOW generic update revalidates an unchanged inactive Faculty", async () => {
  let updates = 0;
  const scenario: Scenario = {
    plot: { facultyId: "faculty-a", status: "FALLOW" },
    assignments: [],
    faculty: faculty({ status: "INACTIVE" }),
  };
  const result = await applyPlotUpdateWithAdviserIntegrity(
    {
      plotId: "plot-a",
      proposedFacultyId: "faculty-a",
      resultingStatus: "PLANTED",
    },
    clientFor(scenario),
    async () => {
      updates += 1;
    }
  );
  assert.equal(result.ok, false);
  assert.equal(updates, 0);
});

test("historical Plot with null adviser and no ACTIVE assignments may re-enter", async () => {
  const result = await validate(
    {
      plot: { facultyId: null, status: "ARCHIVED" },
      assignments: [],
      faculty: null,
    },
    "PREPARING"
  );
  assert.deepEqual(result, { ok: true });
});

test("historical Plot with null adviser and ACTIVE assignment is rejected", async () => {
  const result = await validate(
    {
      plot: { facultyId: null, status: "ARCHIVED" },
      assignments: [activeAssignment("BSA-4A")],
      faculty: null,
    },
    "PREPARING"
  );
  assert.deepEqual(result, {
    ok: false,
    error: ACTIVE_ASSIGNMENTS_REQUIRE_ADVISER_ERROR,
  });
});

test("ACTIVE assignments allow re-entry when adviser owns every exact cohort", async () => {
  const result = await validate(
    {
      plot: { facultyId: "faculty-a", status: "HARVESTED" },
      assignments: [activeAssignment("BSA-4A"), activeAssignment("BSA-3D")],
      faculty: faculty({
        advisories: [
          { course: COURSE, section: "BSA-4A" },
          { course: COURSE, section: "BSA-3D" },
        ],
      }),
    },
    "GROWING"
  );
  assert.deepEqual(result, { ok: true });
});

test("ACTIVE assignments reject re-entry when adviser misses one exact cohort", async () => {
  const result = await validate(
    {
      plot: { facultyId: "faculty-a", status: "HARVESTED" },
      assignments: [activeAssignment("BSA-4A"), activeAssignment("BSA-3D")],
      faculty: faculty({
        advisories: [{ course: COURSE, section: "BSA-4A" }],
      }),
    },
    "GROWING"
  );
  assert.deepEqual(result, {
    ok: false,
    error: INCOMPATIBLE_PLOT_ADVISER_ERROR,
  });
});

test("same unchanged adviser cannot bypass re-entry and invalid entry performs zero updates", async () => {
  let updates = 0;
  const scenario: Scenario = {
    plot: { facultyId: "faculty-a", status: "ARCHIVED" },
    assignments: [],
    faculty: faculty({ status: "INACTIVE" }),
  };
  const result = await applyPlotActivityEntryWithIntegrity(
    { plotId: "plot-a", resultingStatus: "PREPARING" },
    clientFor(scenario),
    async () => {
      updates += 1;
    }
  );
  assert.deepEqual(result, {
    ok: false,
    error: INELIGIBLE_ACTIVITY_ENTRY_ADVISER_ERROR,
  });
  assert.equal(updates, 0);
});
