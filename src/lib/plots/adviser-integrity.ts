import { Prisma } from "@prisma/client";
import { canFacultyAdviseCohort } from "@/lib/auth/section-access";
import { prisma } from "@/lib/prisma";

export const INELIGIBLE_PLOT_ADVISER_ERROR =
  "The selected faculty adviser is not currently eligible.";
export const ACTIVE_ASSIGNMENTS_REQUIRE_ADVISER_ERROR =
  "This plot has active student assignments and must have an eligible faculty adviser.";
export const INCOMPATIBLE_PLOT_ADVISER_ERROR =
  "The selected adviser is not assigned to all active student courses and sections on this plot.";

export type PlotAdviserIntegrityClient = Pick<
  Prisma.TransactionClient,
  "plot" | "plotAssignment" | "user"
>;

type AdviserIntegrityFailure = { ok: false; error: string };
type AdviserIntegritySuccess = { ok: true };
type AdviserIntegrityResult =
  | AdviserIntegrityFailure
  | AdviserIntegritySuccess;

type RunSerializableTransaction = <T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

export type PlotAdviserTransactionDependencies = {
  run: RunSerializableTransaction;
};

const defaultTransactionDependencies: PlotAdviserTransactionDependencies = {
  run: (operation) =>
    prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }),
};

export async function runPlotAdviserTransaction<T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>,
  dependencies: PlotAdviserTransactionDependencies =
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
  throw new Error("Plot adviser transaction retry limit reached.");
}

async function validateSelectedAdviser(
  facultyId: string,
  client: Pick<PlotAdviserIntegrityClient, "user">
): Promise<AdviserIntegrityResult> {
  const adviser = await client.user.findUnique({
    where: { id: facultyId },
    select: { role: true, status: true },
  });

  if (
    !adviser ||
    adviser.role !== "FACULTY" ||
    adviser.status !== "ACTIVE"
  ) {
    return { ok: false, error: INELIGIBLE_PLOT_ADVISER_ERROR };
  }

  return { ok: true };
}

export async function validateNewPlotAdviser(
  facultyId: string | null,
  client: Pick<PlotAdviserIntegrityClient, "user">
): Promise<AdviserIntegrityResult> {
  if (!facultyId) return { ok: true };
  return validateSelectedAdviser(facultyId, client);
}

export async function validatePlotAdviserChange(
  {
    plotId,
    proposedFacultyId,
  }: {
    plotId: string;
    proposedFacultyId: string | null;
  },
  client: PlotAdviserIntegrityClient
): Promise<AdviserIntegrityResult> {
  const plot = await client.plot.findUnique({
    where: { id: plotId },
    select: { facultyId: true },
  });
  if (!plot) return { ok: false, error: "Plot not found" };

  // An ordinary edit with no adviser change must not be blocked by legacy
  // assignment state. A real change cannot disguise itself because both IDs
  // come from authoritative database/input values inside this transaction.
  if (plot.facultyId === proposedFacultyId) return { ok: true };

  const activeAssignments = await client.plotAssignment.findMany({
    where: { plotId, status: "ACTIVE" },
    select: {
      student: {
        select: { course: true, section: true },
      },
    },
  });

  if (!proposedFacultyId) {
    return activeAssignments.length > 0
      ? { ok: false, error: ACTIVE_ASSIGNMENTS_REQUIRE_ADVISER_ERROR }
      : { ok: true };
  }

  const selectedAdviser = await validateSelectedAdviser(
    proposedFacultyId,
    client
  );
  if (!selectedAdviser.ok) return selectedAdviser;

  const distinctCohorts = new Map<
    string,
    { course: string | null; section: string | null }
  >();
  for (const assignment of activeAssignments) {
    const cohort = assignment.student;
    distinctCohorts.set(
      JSON.stringify([cohort.course, cohort.section]),
      cohort
    );
  }

  const authorityChecks = await Promise.all(
    Array.from(distinctCohorts.values()).map((cohort) =>
      canFacultyAdviseCohort(
        proposedFacultyId,
        cohort.course,
        cohort.section,
        client
      )
    )
  );
  if (authorityChecks.some((authorized) => !authorized)) {
    return { ok: false, error: INCOMPATIBLE_PLOT_ADVISER_ERROR };
  }

  return { ok: true };
}

export async function applyPlotUpdateWithAdviserIntegrity<T>(
  input: { plotId: string; proposedFacultyId: string | null },
  client: PlotAdviserIntegrityClient,
  update: () => Promise<T>
): Promise<AdviserIntegrityFailure | { ok: true; value: T }> {
  const validation = await validatePlotAdviserChange(input, client);
  if (!validation.ok) return validation;

  return { ok: true, value: await update() };
}
