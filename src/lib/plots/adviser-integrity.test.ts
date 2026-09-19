import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Prisma,
  type PlotStatus,
  type UserRole,
  type UserStatus,
} from "@prisma/client";
import {
  ACTIVE_ASSIGNMENTS_REQUIRE_ADVISER_ERROR,
  applyPlotUpdateWithAdviserIntegrity,
  INCOMPATIBLE_PLOT_ADVISER_ERROR,
  INELIGIBLE_PLOT_ADVISER_ERROR,
  type PlotAdviserIntegrityClient,
  type PlotAdviserTransactionDependencies,
  runPlotAdviserTransaction,
  validateNewPlotAdviser,
} from "./adviser-integrity";

const COURSE = "BS Agriculture - Crop Science";
const OTHER_COURSE = "BTVTEd - Animal Production";

type Faculty = {
  id: string;
  role: UserRole;
  status: UserStatus;
  department: string | null;
  advisories: { course: string | null; section: string }[];
};

type Assignment = {
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  facultyId: string;
  student: {
    status?: UserStatus;
    course: string | null;
    section: string | null;
  };
};

type Scenario = {
  plot: { facultyId: string | null; status?: PlotStatus } | null;
  assignments: Assignment[];
  faculty: Faculty | null;
};

type QueryCounts = {
  plots: number;
  assignments: number;
  facultyById: number;
  cohortAuthority: number;
};

function activeAssignment(
  section: string,
  overrides: Partial<Assignment> = {}
): Assignment {
  return {
    status: "ACTIVE",
    facultyId: "faculty-old",
    student: { course: COURSE, section },
    ...overrides,
  };
}

function activeFaculty(
  advisories: Faculty["advisories"],
  overrides: Partial<Faculty> = {}
): Faculty {
  return {
    id: "faculty-new",
    role: "FACULTY",
    status: "ACTIVE",
    department: COURSE,
    advisories,
    ...overrides,
  };
}

function clientFor(
  scenario: Scenario,
  counts: QueryCounts = {
    plots: 0,
    assignments: 0,
    facultyById: 0,
    cohortAuthority: 0,
  },
  inspectAssignmentWhere?: (where: unknown) => void
): PlotAdviserIntegrityClient {
  return {
    plot: {
      findUnique: async () => {
        counts.plots += 1;
        return scenario.plot
          ? { ...scenario.plot, status: scenario.plot.status ?? "GROWING" }
          : null;
      },
    },
    plotAssignment: {
      findMany: async (args: { where: { status: Assignment["status"] } }) => {
        counts.assignments += 1;
        inspectAssignmentWhere?.(args.where);
        return scenario.assignments
          .filter((assignment) => assignment.status === args.where.status)
          .map((assignment) => ({ student: assignment.student }));
      },
    },
    user: {
      findUnique: async (args: { where: { id: string } }) => {
        counts.facultyById += 1;
        const faculty = scenario.faculty;
        if (!faculty || faculty.id !== args.where.id) return null;
        return { role: faculty.role, status: faculty.status };
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
        counts.cohortAuthority += 1;
        const faculty = scenario.faculty;
        if (!faculty) return null;
        const where = args.where;
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
  } as unknown as PlotAdviserIntegrityClient;
}

async function applyChange(scenario: Scenario, proposedFacultyId: string | null) {
  let updates = 0;
  const result = await applyPlotUpdateWithAdviserIntegrity(
    { plotId: "plot-a", proposedFacultyId },
    clientFor(scenario),
    async () => {
      updates += 1;
      if (scenario.plot) scenario.plot.facultyId = proposedFacultyId;
      return "updated";
    }
  );
  return { result, updates };
}

test("zero ACTIVE assignments allow a change to an eligible Faculty", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [],
    faculty: activeFaculty([]),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.equal(result.ok, true);
  assert.equal(updates, 1);
});

test("ACTIVE assignments allow a Faculty authorized for every cohort", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A")],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }]),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.equal(result.ok, true);
  assert.equal(updates, 1);
});

test("Faculty missing one active cohort is rejected without an update", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A"), activeAssignment("BSA-3D")],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }]),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.deepEqual(result, { ok: false, error: INCOMPATIBLE_PLOT_ADVISER_ERROR });
  assert.equal(updates, 0);
});

test("inactive Faculty is rejected without an update", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A")],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }], {
      status: "INACTIVE",
    }),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.deepEqual(result, { ok: false, error: INELIGIBLE_PLOT_ADVISER_ERROR });
  assert.equal(updates, 0);
});

test("non-Faculty target is rejected without an update", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A")],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }], {
      role: "ADMIN",
    }),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.deepEqual(result, { ok: false, error: INELIGIBLE_PLOT_ADVISER_ERROR });
  assert.equal(updates, 0);
});

test("null adviser is rejected when ACTIVE assignments exist", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A")],
    faculty: null,
  };
  const { result, updates } = await applyChange(scenario, null);
  assert.deepEqual(result, {
    ok: false,
    error: ACTIVE_ASSIGNMENTS_REQUIRE_ADVISER_ERROR,
  });
  assert.equal(updates, 0);
});

test("multiple Students in the same cohort require one exact authority check", async () => {
  const counts: QueryCounts = {
    plots: 0,
    assignments: 0,
    facultyById: 0,
    cohortAuthority: 0,
  };
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A"), activeAssignment("BSA-4A")],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }]),
  };
  let updates = 0;
  const result = await applyPlotUpdateWithAdviserIntegrity(
    { plotId: "plot-a", proposedFacultyId: "faculty-new" },
    clientFor(scenario, counts),
    async () => {
      updates += 1;
    }
  );
  assert.equal(result.ok, true);
  assert.equal(counts.cohortAuthority, 1);
  assert.equal(updates, 1);
});

test("multiple distinct sections are allowed when all are authorized", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A"), activeAssignment("BSA-3D")],
    faculty: activeFaculty([
      { course: COURSE, section: "BSA-4A" },
      { course: COURSE, section: "BSA-3D" },
    ]),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.equal(result.ok, true);
  assert.equal(updates, 1);
});

test("multiple distinct sections are rejected when only some are authorized", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BSA-4A"), activeAssignment("BSA-3D")],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-3D" }]),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.deepEqual(result, { ok: false, error: INCOMPATIBLE_PLOT_ADVISER_ERROR });
  assert.equal(updates, 0);
});

test("inactive Student with an ACTIVE assignment still constrains transfer", async () => {
  let assignmentWhere: unknown;
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [
      activeAssignment("BTVTED-2B", {
        student: {
          status: "INACTIVE",
          course: OTHER_COURSE,
          section: "BTVTED-2B",
        },
      }),
    ],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }]),
  };
  let updates = 0;
  const result = await applyPlotUpdateWithAdviserIntegrity(
    { plotId: "plot-a", proposedFacultyId: "faculty-new" },
    clientFor(scenario, undefined, (where) => {
      assignmentWhere = where;
    }),
    async () => {
      updates += 1;
    }
  );
  assert.deepEqual(assignmentWhere, { plotId: "plot-a", status: "ACTIVE" });
  assert.deepEqual(result, { ok: false, error: INCOMPATIBLE_PLOT_ADVISER_ERROR });
  assert.equal(updates, 0);
});

test("COMPLETED assignments do not constrain transfer", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [
      activeAssignment("BTVTED-2B", {
        status: "COMPLETED",
        student: { course: OTHER_COURSE, section: "BTVTED-2B" },
      }),
    ],
    faculty: activeFaculty([]),
  };
  const { result, updates } = await applyChange(scenario, "faculty-new");
  assert.equal(result.ok, true);
  assert.equal(updates, 1);
});

test("transfer changes only current Plot adviser, not assignment-time facultyId", async () => {
  const assignment = activeAssignment("BSA-4A");
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [assignment],
    faculty: activeFaculty([{ course: COURSE, section: "BSA-4A" }]),
  };
  const { result } = await applyChange(scenario, "faculty-new");
  assert.equal(result.ok, true);
  assert.equal(scenario.plot?.facultyId, "faculty-new");
  assert.equal(assignment.facultyId, "faculty-old");
  assert.equal(assignment.status, "ACTIVE");
});

test("same-adviser edit is a no-op for transfer validation", async () => {
  const counts: QueryCounts = {
    plots: 0,
    assignments: 0,
    facultyById: 0,
    cohortAuthority: 0,
  };
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [activeAssignment("BTVTED-2B")],
    faculty: null,
  };
  let updates = 0;
  const result = await applyPlotUpdateWithAdviserIntegrity(
    { plotId: "plot-a", proposedFacultyId: "faculty-old" },
    clientFor(scenario, counts),
    async () => {
      updates += 1;
    }
  );
  assert.equal(result.ok, true);
  assert.equal(counts.assignments, 0);
  assert.equal(counts.facultyById, 0);
  assert.equal(updates, 1);
});

test("missing proposed adviser is rejected safely", async () => {
  const scenario: Scenario = {
    plot: { facultyId: "faculty-old" },
    assignments: [],
    faculty: null,
  };
  const { result, updates } = await applyChange(scenario, "missing-faculty");
  assert.deepEqual(result, { ok: false, error: INELIGIBLE_PLOT_ADVISER_ERROR });
  assert.equal(updates, 0);
});

test("new Plot may have no adviser", async () => {
  const result = await validateNewPlotAdviser(
    null,
    clientFor({ plot: null, assignments: [], faculty: null })
  );
  assert.equal(result.ok, true);
});

test("new Plot accepts only an active Faculty when an adviser is selected", async () => {
  const valid = await validateNewPlotAdviser(
    "faculty-new",
    clientFor({
      plot: null,
      assignments: [],
      faculty: activeFaculty([]),
    })
  );
  const invalid = await validateNewPlotAdviser(
    "faculty-new",
    clientFor({
      plot: null,
      assignments: [],
      faculty: activeFaculty([], { status: "INACTIVE" }),
    })
  );
  assert.equal(valid.ok, true);
  assert.deepEqual(invalid, { ok: false, error: INELIGIBLE_PLOT_ADVISER_ERROR });
});

test("serializable runner passes its transaction client to validation", async () => {
  const tx = clientFor({
    plot: { facultyId: "faculty-old" },
    assignments: [],
    faculty: activeFaculty([]),
  }) as unknown as Prisma.TransactionClient;
  const dependencies: PlotAdviserTransactionDependencies = {
    run: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) =>
      operation(tx),
  };
  const result = await runPlotAdviserTransaction(
    async (client) => {
      assert.equal(client, tx);
      return "ok";
    },
    dependencies
  );
  assert.equal(result, "ok");
});

function retryableConflict() {
  return new Prisma.PrismaClientKnownRequestError("serialization conflict", {
    code: "P2034",
    clientVersion: "test",
  });
}

test("serializable runner retries P2034 conflicts and then succeeds", async () => {
  let attempts = 0;
  const dependencies: PlotAdviserTransactionDependencies = {
    run: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
      attempts += 1;
      if (attempts < 3) throw retryableConflict();
      return operation({} as Prisma.TransactionClient);
    },
  };
  const result = await runPlotAdviserTransaction(
    async () => "ok",
    dependencies
  );
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("serializable runner bounds P2034 retries at three attempts", async () => {
  let attempts = 0;
  const dependencies: PlotAdviserTransactionDependencies = {
    run: async () => {
      attempts += 1;
      throw retryableConflict();
    },
  };
  await assert.rejects(
    runPlotAdviserTransaction(async () => "never", dependencies),
    (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
  );
  assert.equal(attempts, 3);
});
