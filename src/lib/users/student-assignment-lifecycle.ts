import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type StudentAssignmentLifecycleClient = Pick<
  Prisma.TransactionClient,
  "plotAssignment"
>;

type StudentEligibilityState = {
  id: string;
  role: UserRole;
  status: UserStatus;
};

type RunSerializableTransaction = <T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

export type StudentLifecycleTransactionDependencies = {
  run: RunSerializableTransaction;
};

const defaultTransactionDependencies: StudentLifecycleTransactionDependencies = {
  run: (operation) =>
    prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }),
};

export function shouldCompleteAssignmentsForStudentTransition(
  current: StudentEligibilityState,
  next: Pick<StudentEligibilityState, "role" | "status">
): boolean {
  if (current.role !== "STUDENT_FARMER") return false;

  const isActiveStudentDeactivation =
    current.status === "ACTIVE" && next.status === "INACTIVE";
  const isLeavingStudentRole = next.role !== "STUDENT_FARMER";

  return isActiveStudentDeactivation || isLeavingStudentRole;
}

export async function completeActiveAssignmentsForStudents(
  client: StudentAssignmentLifecycleClient,
  studentIds: string[],
  transitionAt: Date
): Promise<number> {
  if (studentIds.length === 0) return 0;

  const result = await client.plotAssignment.updateMany({
    where: {
      studentId: { in: studentIds },
      status: "ACTIVE",
    },
    data: {
      status: "COMPLETED",
      endedAt: transitionAt,
    },
  });

  return result.count;
}

export async function applyUserUpdateWithStudentAssignmentLifecycle<T>(
  input: {
    current: StudentEligibilityState;
    next: Pick<StudentEligibilityState, "role" | "status">;
    transitionAt: Date;
  },
  client: StudentAssignmentLifecycleClient,
  updateUser: () => Promise<T>
): Promise<{ user: T; completedAssignmentCount: number }> {
  const user = await updateUser();
  const completedAssignmentCount =
    shouldCompleteAssignmentsForStudentTransition(input.current, input.next)
      ? await completeActiveAssignmentsForStudents(
          client,
          [input.current.id],
          input.transitionAt
        )
      : 0;

  return { user, completedAssignmentCount };
}

export async function runStudentAssignmentLifecycleTransaction<T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>,
  dependencies: StudentLifecycleTransactionDependencies =
    defaultTransactionDependencies
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await dependencies.run(operation);
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error("Student assignment lifecycle retry limit reached.");
}
