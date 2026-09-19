import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { academicCohortKey } from "@/lib/academics/cohort-integrity";
import { ACTIVITY_PLOT_STATUSES } from "@/lib/plots/lifecycle";
import { prisma } from "@/lib/prisma";

export const FACULTY_DEACTIVATION_PLOT_ERROR =
  "This faculty member is still assigned as adviser to active plots. Reassign those plots before deactivating the account.";
export const FACULTY_ROLE_CHANGE_PLOT_ERROR =
  "This faculty member is still assigned as adviser to active plots. Reassign those plots before changing the role.";
export const FACULTY_DEPARTMENT_ASSIGNMENT_ERROR =
  "This department change conflicts with active student assignments on plots advised by this faculty member.";
export const REQUIRED_FACULTY_ADVISORY_ERROR =
  "One or more advisories are still required by active student assignments. Reassign or complete those assignments before removing the advisory.";

export type FacultyOperationalIntegrityClient = Pick<
  Prisma.TransactionClient,
  "plot" | "plotAssignment"
>;

type FacultyState = {
  id: string;
  role: UserRole;
  status: UserStatus;
  department: string | null;
};

type FacultyTransitionResult =
  | { ok: true }
  | { ok: false; error: string };

type AcademicCohort = { course: string; section: string };

type RunSerializableTransaction = <T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

export type FacultyOperationalTransactionDependencies = {
  run: RunSerializableTransaction;
};

const defaultTransactionDependencies: FacultyOperationalTransactionDependencies = {
  run: (operation) =>
    prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }),
};

export async function runFacultyOperationalTransaction<T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>,
  dependencies: FacultyOperationalTransactionDependencies =
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

  throw new Error("Faculty operational transaction retry limit reached.");
}

/**
 * Validates a Faculty eligibility transition against current operational
 * responsibility. Plot.facultyId is authoritative; PlotAssignment.facultyId
 * is deliberately absent because it is assignment-time history.
 */
export async function validateFacultyOperationalTransition(
  current: FacultyState,
  next: Pick<FacultyState, "role" | "status" | "department">,
  client: FacultyOperationalIntegrityClient
): Promise<FacultyTransitionResult> {
  if (current.role !== "FACULTY") return { ok: true };

  const leavingFacultyRole = next.role !== "FACULTY";
  const deactivatingFaculty =
    current.status === "ACTIVE" && next.status === "INACTIVE";

  if (leavingFacultyRole || deactivatingFaculty) {
    const currentActivityPlot = await client.plot.findFirst({
      where: {
        facultyId: current.id,
        status: { in: ACTIVITY_PLOT_STATUSES },
      },
      select: { id: true },
    });

    if (currentActivityPlot) {
      return {
        ok: false,
        error: leavingFacultyRole
          ? FACULTY_ROLE_CHANGE_PLOT_ERROR
          : FACULTY_DEACTIVATION_PLOT_ERROR,
      };
    }
  }

  const changingFacultyDepartment =
    next.role === "FACULTY" && current.department !== next.department;
  if (!changingFacultyDepartment) return { ok: true };

  const conflictingAssignment = await client.plotAssignment.findFirst({
    where: {
      status: "ACTIVE",
      plot: {
        facultyId: current.id,
        status: { in: ACTIVITY_PLOT_STATUSES },
      },
      student: {
        OR: [
          { course: null },
          { course: { not: next.department } },
        ],
      },
    },
    select: { id: true },
  });

  return conflictingAssignment
    ? { ok: false, error: FACULTY_DEPARTMENT_ASSIGNMENT_ERROR }
    : { ok: true };
}

/** Returns exact non-null Course + Section identities absent from the final set. */
export function removedFacultyAdvisoryCohorts(
  existing: ReadonlyArray<{ course: string | null; section: string }>,
  final: ReadonlyArray<{ course: string | null; section: string }>
): AcademicCohort[] {
  const finalKeys = new Set(
    final.flatMap((cohort) =>
      cohort.course
        ? [academicCohortKey({ course: cohort.course, section: cohort.section })]
        : []
    )
  );
  const removed = new Map<string, AcademicCohort>();

  for (const cohort of existing) {
    if (!cohort.course) continue;
    const exact = { course: cohort.course, section: cohort.section };
    const key = academicCohortKey(exact);
    if (!finalKeys.has(key)) removed.set(key, exact);
  }

  return [...removed.values()];
}

export async function validateFacultyAdvisoryRemoval(
  facultyId: string,
  removedCohorts: ReadonlyArray<AcademicCohort>,
  client: Pick<FacultyOperationalIntegrityClient, "plotAssignment">
): Promise<FacultyTransitionResult> {
  if (removedCohorts.length === 0) return { ok: true };

  const dependency = await client.plotAssignment.findFirst({
    where: {
      status: "ACTIVE",
      plot: {
        facultyId,
        status: { in: ACTIVITY_PLOT_STATUSES },
      },
      OR: removedCohorts.map((cohort) => ({
        student: {
          course: cohort.course,
          section: cohort.section,
        },
      })),
    },
    select: { id: true },
  });

  return dependency
    ? { ok: false, error: REQUIRED_FACULTY_ADVISORY_ERROR }
    : { ok: true };
}
