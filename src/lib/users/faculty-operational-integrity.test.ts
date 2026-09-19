import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  Prisma,
  type PlotStatus,
  type UserRole,
  type UserStatus,
} from "@prisma/client";
import { resultingFacultyAdvisoryError } from "@/lib/academics/cohort-integrity";
import {
  FACULTY_DEACTIVATION_PLOT_ERROR,
  FACULTY_DEPARTMENT_ASSIGNMENT_ERROR,
  FACULTY_ROLE_CHANGE_PLOT_ERROR,
  REQUIRED_FACULTY_ADVISORY_ERROR,
  removedFacultyAdvisoryCohorts,
  runFacultyOperationalTransaction,
  validateFacultyAdvisoryRemoval,
  validateFacultyOperationalTransition,
  type FacultyOperationalIntegrityClient,
  type FacultyOperationalTransactionDependencies,
} from "./faculty-operational-integrity";

const COURSE = "BS Agriculture - Crop Science";
const OTHER_COURSE = "BTVTEd - Animal Production";

type Plot = { id: string; facultyId: string | null; status: PlotStatus };
type Assignment = {
  id: string;
  plotId: string;
  facultyId: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  student: { course: string | null; section: string | null };
};

function faculty(
  overrides: Partial<{
    id: string;
    role: UserRole;
    status: UserStatus;
    department: string | null;
  }> = {}
) {
  return {
    id: "faculty-a",
    role: "FACULTY" as UserRole,
    status: "ACTIVE" as UserStatus,
    department: COURSE,
    ...overrides,
  };
}

function plot(
  id: string,
  status: PlotStatus = "GROWING",
  facultyId: string | null = "faculty-a"
): Plot {
  return { id, status, facultyId };
}

function assignment(
  id: string,
  plotId: string,
  course: string | null = COURSE,
  section: string | null = "BSA-4A",
  overrides: Partial<Assignment> = {}
): Assignment {
  return {
    id,
    plotId,
    facultyId: "faculty-at-assignment-time",
    status: "ACTIVE",
    student: { course, section },
    ...overrides,
  };
}

function clientFor(
  plots: Plot[],
  assignments: Assignment[],
  inspect?: {
    plotWhere?: (where: unknown) => void;
    assignmentWhere?: (where: unknown) => void;
  }
): FacultyOperationalIntegrityClient {
  return {
    plot: {
      findFirst: async (args: {
        where: { facultyId: string; status: { in: PlotStatus[] } };
      }) => {
        inspect?.plotWhere?.(args.where);
        return (
          plots.find(
            (row) =>
              row.facultyId === args.where.facultyId &&
              args.where.status.in.includes(row.status)
          ) ?? null
        );
      },
    },
    plotAssignment: {
      findFirst: async (args: {
        where: {
          status: Assignment["status"];
          plot: { facultyId: string; status: { in: PlotStatus[] } };
          student?: {
            OR: Array<
              | { course: null }
              | { course: { not: string | null } }
            >;
          };
          OR?: Array<{
            student: { course: string; section: string };
          }>;
        };
      }) => {
        inspect?.assignmentWhere?.(args.where);
        return (
          assignments.find((row) => {
            if (row.status !== args.where.status) return false;
            const currentPlot = plots.find((candidate) => candidate.id === row.plotId);
            if (
              !currentPlot ||
              currentPlot.facultyId !== args.where.plot.facultyId ||
              !args.where.plot.status.in.includes(currentPlot.status)
            ) {
              return false;
            }
            if (args.where.OR) {
              return args.where.OR.some(
                ({ student }) =>
                  row.student.course === student.course &&
                  row.student.section === student.section
              );
            }
            const expected = args.where.student?.OR.find(
              (condition): condition is { course: { not: string | null } } =>
                typeof condition.course === "object" && condition.course !== null
            )?.course.not;
            return row.student.course === null || row.student.course !== expected;
          }) ?? null
        );
      },
    },
  } as unknown as FacultyOperationalIntegrityClient;
}

async function validateTransition(
  current: ReturnType<typeof faculty>,
  next: Partial<Pick<ReturnType<typeof faculty>, "role" | "status" | "department">>,
  plots: Plot[] = [],
  assignments: Assignment[] = []
) {
  return validateFacultyOperationalTransition(
    current,
    {
      role: next.role ?? current.role,
      status: next.status ?? current.status,
      department:
        next.department === undefined ? current.department : next.department,
    },
    clientFor(plots, assignments)
  );
}

test("Faculty with zero activity Plots may be deactivated", async () => {
  assert.deepEqual(
    await validateTransition(faculty(), { status: "INACTIVE" }),
    { ok: true }
  );
});

test("Faculty with an activity Plot and zero assignments cannot be deactivated", async () => {
  assert.deepEqual(
    await validateTransition(faculty(), { status: "INACTIVE" }, [plot("p")]),
    { ok: false, error: FACULTY_DEACTIVATION_PLOT_ERROR }
  );
});

test("Faculty with an activity Plot and ACTIVE assignments cannot be deactivated", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty(),
      { status: "INACTIVE" },
      [plot("p")],
      [assignment("a", "p")]
    ),
    { ok: false, error: FACULTY_DEACTIVATION_PLOT_ERROR }
  );
});

test("Faculty with only historical Plots may be deactivated", async () => {
  const historical: PlotStatus[] = ["HARVESTED", "FALLOW", "ARCHIVED"];
  assert.deepEqual(
    await validateTransition(
      faculty(),
      { status: "INACTIVE" },
      historical.map((status, index) => plot(`p-${index}`, status))
    ),
    { ok: true }
  );
});

test("historical PlotAssignment.facultyId alone does not block deactivation", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty(),
      { status: "INACTIVE" },
      [plot("p", "GROWING", "faculty-b")],
      [assignment("a", "p", COURSE, "BSA-4A", { facultyId: "faculty-a" })]
    ),
    { ok: true }
  );
});

test("Student deactivation is unaffected by the Faculty guard", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty({ role: "STUDENT_FARMER" }),
      { status: "INACTIVE" },
      [plot("p")]
    ),
    { ok: true }
  );
});

test("FACULTY role exit is rejected while advising an activity Plot", async () => {
  assert.deepEqual(
    await validateTransition(faculty(), { role: "ADMIN" }, [plot("p")]),
    { ok: false, error: FACULTY_ROLE_CHANGE_PLOT_ERROR }
  );
});

test("FACULTY role exit is allowed by this guard with no activity Plot", async () => {
  assert.deepEqual(await validateTransition(faculty(), { role: "ADMIN" }), {
    ok: true,
  });
});

test("non-Faculty role changes do not invoke the Faculty guard", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty({ role: "ADMIN" }),
      { role: "SUPER_ADMIN" },
      [plot("p")]
    ),
    { ok: true }
  );
});

test("matching ACTIVE Student courses allow a Faculty department change", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty({ department: OTHER_COURSE }),
      { department: COURSE },
      [plot("p")],
      [assignment("a", "p", COURSE)]
    ),
    { ok: true }
  );
});

test("one conflicting ACTIVE Student rejects a Faculty department change", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty(),
      { department: OTHER_COURSE },
      [plot("p")],
      [assignment("a", "p", COURSE)]
    ),
    { ok: false, error: FACULTY_DEPARTMENT_ASSIGNMENT_ERROR }
  );
});

test("multiple ACTIVE Students with the resulting course allow department change", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty({ department: OTHER_COURSE }),
      { department: COURSE },
      [plot("p")],
      [assignment("a", "p", COURSE), assignment("b", "p", COURSE, "BSA-3D")]
    ),
    { ok: true }
  );
});

test("mixed-course ACTIVE assignments reject a single resulting department", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty({ department: "old" }),
      { department: COURSE },
      [plot("p")],
      [assignment("a", "p", COURSE), assignment("b", "p", OTHER_COURSE)]
    ),
    { ok: false, error: FACULTY_DEPARTMENT_ASSIGNMENT_ERROR }
  );
});

test("COMPLETED assignments do not constrain Faculty department changes", async () => {
  assert.deepEqual(
    await validateTransition(
      faculty(),
      { department: OTHER_COURSE },
      [plot("p")],
      [assignment("a", "p", COURSE, "BSA-4A", { status: "COMPLETED" })]
    ),
    { ok: true }
  );
});

test("retained advisory incompatibility remains rejected by the existing guard", () => {
  assert.ok(
    resultingFacultyAdvisoryError("FACULTY", OTHER_COURSE, [
      { course: COURSE },
    ])
  );
});

test("removing an unused advisory is allowed", async () => {
  assert.deepEqual(
    await validateFacultyAdvisoryRemoval(
      "faculty-a",
      [{ course: COURSE, section: "BSA-4A" }],
      clientFor([plot("p")], [])
    ),
    { ok: true }
  );
});

test("removing an exact advisory required by an ACTIVE assignment is rejected", async () => {
  assert.deepEqual(
    await validateFacultyAdvisoryRemoval(
      "faculty-a",
      [{ course: COURSE, section: "BSA-4A" }],
      clientFor([plot("p")], [assignment("a", "p")])
    ),
    { ok: false, error: REQUIRED_FACULTY_ADVISORY_ERROR }
  );
});

test("removing one of several required advisories rejects the whole update", async () => {
  const removed = removedFacultyAdvisoryCohorts(
    [
      { course: COURSE, section: "BSA-4A" },
      { course: COURSE, section: "BSA-3D" },
    ],
    [{ course: COURSE, section: "BSA-4A" }]
  );
  assert.deepEqual(
    await validateFacultyAdvisoryRemoval(
      "faculty-a",
      removed,
      clientFor(
        [plot("p")],
        [assignment("a", "p", COURSE, "BSA-3D")]
      )
    ),
    { ok: false, error: REQUIRED_FACULTY_ADVISORY_ERROR }
  );
});

test("adding an advisory only produces no removed dependency", () => {
  assert.deepEqual(
    removedFacultyAdvisoryCohorts(
      [{ course: COURSE, section: "BSA-4A" }],
      [
        { course: COURSE, section: "BSA-4A" },
        { course: COURSE, section: "BSA-3D" },
      ]
    ),
    []
  );
});

test("a semantically unchanged reordered advisory set has no removals", () => {
  const first = { course: COURSE, section: "BSA-4A" };
  const second = { course: COURSE, section: "BSA-3D" };
  assert.deepEqual(
    removedFacultyAdvisoryCohorts([first, second], [second, first]),
    []
  );
});

test("COMPLETED assignment dependencies do not block advisory removal", async () => {
  assert.deepEqual(
    await validateFacultyAdvisoryRemoval(
      "faculty-a",
      [{ course: COURSE, section: "BSA-4A" }],
      clientFor(
        [plot("p")],
        [assignment("a", "p", COURSE, "BSA-4A", { status: "COMPLETED" })]
      )
    ),
    { ok: true }
  );
});

test("assignment-time old facultyId does not block the old Faculty advisory removal", async () => {
  assert.deepEqual(
    await validateFacultyAdvisoryRemoval(
      "faculty-a",
      [{ course: COURSE, section: "BSA-4A" }],
      clientFor(
        [plot("p", "GROWING", "faculty-b")],
        [assignment("a", "p", COURSE, "BSA-4A", { facultyId: "faculty-a" })]
      )
    ),
    { ok: true }
  );
});

test("null legacy advisories provide no exact removable dependency identity", () => {
  assert.deepEqual(
    removedFacultyAdvisoryCohorts(
      [{ course: null, section: "BSA-4A" }],
      []
    ),
    []
  );
});

test("all canonical activity statuses constrain Faculty deactivation", async () => {
  const activity: PlotStatus[] = [
    "PREPARING",
    "PLANTED",
    "GROWING",
    "READY_FOR_HARVEST",
  ];
  for (const status of activity) {
    const result = await validateTransition(
      faculty(),
      { status: "INACTIVE" },
      [plot(status, status)]
    );
    assert.deepEqual(result, {
      ok: false,
      error: FACULTY_DEACTIVATION_PLOT_ERROR,
    });
  }
});

test("advisory dependency follows current Plot adviser even when assignment-time Faculty differs", async () => {
  assert.deepEqual(
    await validateFacultyAdvisoryRemoval(
      "faculty-a",
      [{ course: COURSE, section: "BSA-4A" }],
      clientFor(
        [plot("p")],
        [assignment("a", "p", COURSE, "BSA-4A", { facultyId: "faculty-old" })]
      )
    ),
    { ok: false, error: REQUIRED_FACULTY_ADVISORY_ERROR }
  );
});

test("dependency queries use ACTIVE assignments joined through activity Plot responsibility", async () => {
  let where: unknown;
  await validateFacultyAdvisoryRemoval(
    "faculty-a",
    [{ course: COURSE, section: "BSA-4A" }],
    clientFor([], [], { assignmentWhere: (value) => (where = value) })
  );
  assert.deepEqual(where, {
    status: "ACTIVE",
    plot: {
      facultyId: "faculty-a",
      status: {
        in: ["PREPARING", "PLANTED", "GROWING", "READY_FOR_HARVEST"],
      },
    },
    OR: [
      { student: { course: COURSE, section: "BSA-4A" } },
    ],
  });
});

test("serializable runner passes its transaction client", async () => {
  const tx = {} as Prisma.TransactionClient;
  const dependencies: FacultyOperationalTransactionDependencies = {
    run: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) =>
      operation(tx),
  };
  assert.equal(
    await runFacultyOperationalTransaction(async (client) => {
      assert.equal(client, tx);
      return "ok";
    }, dependencies),
    "ok"
  );
});

function retryableConflict() {
  return new Prisma.PrismaClientKnownRequestError("serialization conflict", {
    code: "P2034",
    clientVersion: "test",
  });
}

test("serializable runner retries P2034 and then succeeds", async () => {
  let attempts = 0;
  const dependencies: FacultyOperationalTransactionDependencies = {
    run: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
      attempts += 1;
      if (attempts < 3) throw retryableConflict();
      return operation({} as Prisma.TransactionClient);
    },
  };
  assert.equal(
    await runFacultyOperationalTransaction(async () => "ok", dependencies),
    "ok"
  );
  assert.equal(attempts, 3);
});

test("serializable runner bounds P2034 retries at three attempts", async () => {
  let attempts = 0;
  const dependencies: FacultyOperationalTransactionDependencies = {
    run: async () => {
      attempts += 1;
      throw retryableConflict();
    },
  };
  await assert.rejects(
    runFacultyOperationalTransaction(async () => "never", dependencies),
    (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
  );
  assert.equal(attempts, 3);
});

function source(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

test("web, dedicated, mobile, and advisory paths use the shared Faculty policy", () => {
  const users = source("src", "actions", "users.ts");
  const mobile = source(
    "src",
    "app",
    "api",
    "mobile",
    "me",
    "users",
    "[id]",
    "route.ts"
  );
  const advisories = source("src", "actions", "advisories.ts");

  assert.match(
    users,
    /updateUser[\s\S]*?runStudentAssignmentLifecycleTransaction[\s\S]*?validateFacultyOperationalTransition/
  );
  assert.match(
    users,
    /deactivateUser[\s\S]*?runStudentAssignmentLifecycleTransaction[\s\S]*?validateFacultyOperationalTransition/
  );
  assert.match(
    mobile,
    /PATCH[\s\S]*?runStudentAssignmentLifecycleTransaction[\s\S]*?validateFacultyOperationalTransition/
  );
  assert.match(
    advisories,
    /runFacultyOperationalTransaction[\s\S]*?removedFacultyAdvisoryCohorts[\s\S]*?validateFacultyAdvisoryRemoval/
  );
});
