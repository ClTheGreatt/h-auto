import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import {
  applyUserUpdateWithStudentAssignmentLifecycle,
  completeActiveAssignmentsForStudents,
  runStudentAssignmentLifecycleTransaction,
  shouldCompleteAssignmentsForStudentTransition,
  type StudentAssignmentLifecycleClient,
  type StudentLifecycleTransactionDependencies,
} from "./student-assignment-lifecycle";

type Assignment = {
  id: string;
  studentId: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  endedAt: Date | null;
  plotId: string;
  facultyId: string;
  assignedById: string;
  assignedAt: Date;
  notes: string | null;
};

const TRANSITION_AT = new Date("2026-09-18T08:30:00.000Z");

function assignment(
  id: string,
  studentId: string,
  status: Assignment["status"] = "ACTIVE"
): Assignment {
  return {
    id,
    studentId,
    status,
    endedAt:
      status === "ACTIVE" ? null : new Date("2026-08-01T00:00:00.000Z"),
    plotId: `plot-${id}`,
    facultyId: "faculty-a",
    assignedById: "admin-a",
    assignedAt: new Date("2026-07-01T00:00:00.000Z"),
    notes: `note-${id}`,
  };
}

function clientFor(
  assignments: Assignment[],
  onUpdate?: (args: unknown) => void
): StudentAssignmentLifecycleClient {
  return {
    plotAssignment: {
      updateMany: async (args: {
        where: {
          studentId: { in: string[] };
          status: Assignment["status"];
        };
        data: Pick<Assignment, "status" | "endedAt">;
      }) => {
        onUpdate?.(args);
        let count = 0;
        for (const row of assignments) {
          if (
            args.where.studentId.in.includes(row.studentId) &&
            row.status === args.where.status
          ) {
            row.status = args.data.status;
            row.endedAt = args.data.endedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
  } as unknown as StudentAssignmentLifecycleClient;
}

function state(
  role: UserRole = "STUDENT_FARMER",
  status: UserStatus = "ACTIVE"
) {
  return { id: "student-a", role, status };
}

test("ACTIVE Student deactivation requires assignment completion", () => {
  assert.equal(
    shouldCompleteAssignmentsForStudentTransition(state(), {
      role: "STUDENT_FARMER",
      status: "INACTIVE",
    }),
    true
  );
});

test("non-Student deactivation does not invoke Student assignment lifecycle", () => {
  assert.equal(
    shouldCompleteAssignmentsForStudentTransition(state("FACULTY"), {
      role: "FACULTY",
      status: "INACTIVE",
    }),
    false
  );
});

test("leaving STUDENT_FARMER requires assignment completion", () => {
  assert.equal(
    shouldCompleteAssignmentsForStudentTransition(state(), {
      role: "FACULTY",
      status: "ACTIVE",
    }),
    true
  );
});

test("an unrelated active Student edit leaves assignments alone", () => {
  assert.equal(
    shouldCompleteAssignmentsForStudentTransition(state(), {
      role: "STUDENT_FARMER",
      status: "ACTIVE",
    }),
    false
  );
});

test("reactivation does not restore completed assignments", async () => {
  const rows = [assignment("history", "student-a", "COMPLETED")];
  const before = structuredClone(rows);
  await applyUserUpdateWithStudentAssignmentLifecycle(
    {
      current: state("STUDENT_FARMER", "INACTIVE"),
      next: { role: "STUDENT_FARMER", status: "ACTIVE" },
      transitionAt: TRANSITION_AT,
    },
    clientFor(rows),
    async () => "updated"
  );
  assert.deepEqual(rows, before);
});

test("an already INACTIVE Student status no-op does not rewrite history", async () => {
  const rows = [assignment("history", "student-a", "COMPLETED")];
  const before = structuredClone(rows);
  await applyUserUpdateWithStudentAssignmentLifecycle(
    {
      current: state("STUDENT_FARMER", "INACTIVE"),
      next: { role: "STUDENT_FARMER", status: "INACTIVE" },
      transitionAt: TRANSITION_AT,
    },
    clientFor(rows),
    async () => "updated"
  );
  assert.deepEqual(rows, before);
});

test("deactivation completes one ACTIVE assignment with the supplied timestamp", async () => {
  const rows = [assignment("active", "student-a")];
  const result = await applyUserUpdateWithStudentAssignmentLifecycle(
    {
      current: state(),
      next: { role: "STUDENT_FARMER", status: "INACTIVE" },
      transitionAt: TRANSITION_AT,
    },
    clientFor(rows),
    async () => ({ status: "INACTIVE" as const })
  );
  assert.equal(result.user.status, "INACTIVE");
  assert.equal(result.completedAssignmentCount, 1);
  assert.equal(rows[0].status, "COMPLETED");
  assert.equal(rows[0].endedAt, TRANSITION_AT);
});

test("deactivation completes every ACTIVE assignment for the Student", async () => {
  const rows = [
    assignment("one", "student-a"),
    assignment("two", "student-a"),
    assignment("other", "student-b"),
  ];
  const result = await applyUserUpdateWithStudentAssignmentLifecycle(
    {
      current: state(),
      next: { role: "STUDENT_FARMER", status: "INACTIVE" },
      transitionAt: TRANSITION_AT,
    },
    clientFor(rows),
    async () => "updated"
  );
  assert.equal(result.completedAssignmentCount, 2);
  assert.deepEqual(
    rows.map((row) => row.status),
    ["COMPLETED", "COMPLETED", "ACTIVE"]
  );
});

test("historical COMPLETED assignment fields remain unchanged", async () => {
  const historical = assignment("history", "student-a", "COMPLETED");
  const before = structuredClone(historical);
  const rows = [historical, assignment("active", "student-a")];
  await completeActiveAssignmentsForStudents(
    clientFor(rows),
    ["student-a"],
    TRANSITION_AT
  );
  assert.deepEqual(historical, before);
});

test("deactivation with no assignments still updates the User", async () => {
  let userUpdates = 0;
  const result = await applyUserUpdateWithStudentAssignmentLifecycle(
    {
      current: state(),
      next: { role: "STUDENT_FARMER", status: "INACTIVE" },
      transitionAt: TRANSITION_AT,
    },
    clientFor([]),
    async () => {
      userUpdates += 1;
      return "updated";
    }
  );
  assert.equal(userUpdates, 1);
  assert.equal(result.completedAssignmentCount, 0);
});

test("role change away from STUDENT_FARMER completes ACTIVE assignments", async () => {
  const rows = [assignment("active", "student-a")];
  await applyUserUpdateWithStudentAssignmentLifecycle(
    {
      current: state(),
      next: { role: "FACULTY", status: "ACTIVE" },
      transitionAt: TRANSITION_AT,
    },
    clientFor(rows),
    async () => "updated"
  );
  assert.equal(rows[0].status, "COMPLETED");
});

test("graduation helper completes one Student's ACTIVE assignment", async () => {
  const rows = [assignment("active", "student-a")];
  const count = await completeActiveAssignmentsForStudents(
    clientFor(rows),
    ["student-a"],
    TRANSITION_AT
  );
  assert.equal(count, 1);
  assert.equal(rows[0].endedAt, TRANSITION_AT);
});

test("graduation helper completes a coherent multi-Student batch", async () => {
  const rows = [
    assignment("one", "student-a"),
    assignment("two", "student-b"),
    assignment("other", "student-c"),
  ];
  const count = await completeActiveAssignmentsForStudents(
    clientFor(rows),
    ["student-a", "student-b"],
    TRANSITION_AT
  );
  assert.equal(count, 2);
  assert.deepEqual(
    rows.map((row) => row.status),
    ["COMPLETED", "COMPLETED", "ACTIVE"]
  );
});

test("completion helper sends only lifecycle fields to updateMany", async () => {
  let updateArgs: unknown;
  await completeActiveAssignmentsForStudents(
    clientFor([assignment("active", "student-a")], (args) => {
      updateArgs = args;
    }),
    ["student-a"],
    TRANSITION_AT
  );
  assert.deepEqual(updateArgs, {
    where: { studentId: { in: ["student-a"] }, status: "ACTIVE" },
    data: { status: "COMPLETED", endedAt: TRANSITION_AT },
  });
});

test("empty Student ID input performs no database update", async () => {
  let calls = 0;
  const count = await completeActiveAssignmentsForStudents(
    clientFor([], () => {
      calls += 1;
    }),
    [],
    TRANSITION_AT
  );
  assert.equal(count, 0);
  assert.equal(calls, 0);
});

test("User update failure prevents assignment completion", async () => {
  let assignmentUpdates = 0;
  await assert.rejects(
    applyUserUpdateWithStudentAssignmentLifecycle(
      {
        current: state(),
        next: { role: "STUDENT_FARMER", status: "INACTIVE" },
        transitionAt: TRANSITION_AT,
      },
      clientFor([], () => {
        assignmentUpdates += 1;
      }),
      async () => {
        throw new Error("user update failed");
      }
    ),
    /user update failed/
  );
  assert.equal(assignmentUpdates, 0);
});

test("assignment completion failure propagates so its transaction can roll back", async () => {
  let userUpdates = 0;
  const failingClient = {
    plotAssignment: {
      updateMany: async () => {
        throw new Error("assignment update failed");
      },
    },
  } as unknown as StudentAssignmentLifecycleClient;
  await assert.rejects(
    applyUserUpdateWithStudentAssignmentLifecycle(
      {
        current: state(),
        next: { role: "STUDENT_FARMER", status: "INACTIVE" },
        transitionAt: TRANSITION_AT,
      },
      failingClient,
      async () => {
        userUpdates += 1;
        return "updated";
      }
    ),
    /assignment update failed/
  );
  assert.equal(userUpdates, 1);
});

test("serializable runner passes its transaction client to the operation", async () => {
  const tx = {} as Prisma.TransactionClient;
  const dependencies: StudentLifecycleTransactionDependencies = {
    run: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) =>
      operation(tx),
  };
  const result = await runStudentAssignmentLifecycleTransaction(
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

test("serializable runner retries P2034 and succeeds", async () => {
  let attempts = 0;
  const dependencies: StudentLifecycleTransactionDependencies = {
    run: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
      attempts += 1;
      if (attempts < 3) throw retryableConflict();
      return operation({} as Prisma.TransactionClient);
    },
  };
  assert.equal(
    await runStudentAssignmentLifecycleTransaction(
      async () => "ok",
      dependencies
    ),
    "ok"
  );
  assert.equal(attempts, 3);
});

test("serializable runner bounds P2034 retry at three attempts", async () => {
  let attempts = 0;
  const dependencies: StudentLifecycleTransactionDependencies = {
    run: async () => {
      attempts += 1;
      throw retryableConflict();
    },
  };
  await assert.rejects(
    runStudentAssignmentLifecycleTransaction(async () => "never", dependencies),
    (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
  );
  assert.equal(attempts, 3);
});

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

const usersAction = source("src", "actions", "users.ts");
const mobileUserRoute = source(
  "src",
  "app",
  "api",
  "mobile",
  "me",
  "users",
  "[id]",
  "route.ts"
);

test("web edit and dedicated deactivation use the shared lifecycle transaction", () => {
  assert.match(
    usersAction,
    /updateUser[\s\S]*?runStudentAssignmentLifecycleTransaction[\s\S]*?applyUserUpdateWithStudentAssignmentLifecycle/
  );
  assert.match(
    usersAction,
    /deactivateUser[\s\S]*?runStudentAssignmentLifecycleTransaction[\s\S]*?applyUserUpdateWithStudentAssignmentLifecycle/
  );
});

test("graduation revalidates and completes assignments in the shared transaction", () => {
  assert.match(
    usersAction,
    /graduateStudents[\s\S]*?runStudentAssignmentLifecycleTransaction\(async \(tx\)[\s\S]*?tx\.user\.findMany[\s\S]*?tx\.user\.updateMany[\s\S]*?completeActiveAssignmentsForStudents\(tx, userIds, graduatedAt\)/
  );
});

test("ungraduation never writes PlotAssignment state", () => {
  const body = usersAction.slice(usersAction.indexOf("export async function ungraduateStudents"));
  assert.doesNotMatch(body, /plotAssignment|completeActiveAssignmentsForStudents/);
});

test("mobile PATCH uses the shared transaction and invalidates status sessions", () => {
  assert.match(
    mobileUserRoute,
    /PATCH[\s\S]*?runStudentAssignmentLifecycleTransaction[\s\S]*?applyUserUpdateWithStudentAssignmentLifecycle/
  );
  assert.match(
    mobileUserRoute,
    /status === "INACTIVE" \|\| isReactivating[\s\S]*?tokenVersion = \{ increment: 1 \}/
  );
});
