import { Prisma } from "@prisma/client";

const ACTIVE_PAIR_INDEX = "PlotAssignment_active_plot_student_unique";

// A raw partial index may report its index name, columns, or no target at all
// depending on Prisma's error metadata. Reject identified unrelated targets;
// callers also verify that the specific ACTIVE pair now exists before
// returning an already-assigned response.
export function mayBeActivePairUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (typeof target === "string") {
    return target === ACTIVE_PAIR_INDEX ||
      (target.includes("plotId") && target.includes("studentId"));
  }
  if (Array.isArray(target)) {
    return target.length === 2 && target.includes("plotId") && target.includes("studentId");
  }
  return target == null;
}
