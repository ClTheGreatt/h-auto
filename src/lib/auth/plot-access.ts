import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";
export { isValidPlotId } from "@/lib/auth/plot-id";

type FindAccessiblePlot = (
  where: Prisma.PlotWhereInput
) => Promise<{ id: string } | null>;

type FindReadingHistoryPlot<T> = (
  where: Prisma.PlotWhereInput
) => Promise<T | null>;

export function buildDirectPlotAccessWhere(
  role: UserRole,
  userId: string,
  plotId: string
): Prisma.PlotWhereInput {
  return buildAccessiblePlotWhere({ role, userId }, { id: plotId });
}

export async function findReadingHistoryPlot<T>(
  role: UserRole,
  userId: string,
  plotId: string,
  findPlot: FindReadingHistoryPlot<T>
): Promise<T | null> {
  return findPlot(buildDirectPlotAccessWhere(role, userId, plotId));
}

// Faculty access is based on being the plot's assigned adviser
// (Plot.facultyId), unlike ADMIN/SUPER_ADMIN which have unrestricted access.
export async function canFacultyAccessPlot(
  userId: string,
  plotId: string
): Promise<boolean> {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    select: { facultyId: true },
  });
  return plot?.facultyId === userId;
}

// True if this user may access/act on this plot.
// ADMIN/SUPER_ADMIN: any plot. FACULTY: only plots they advise.
// STUDENT_FARMER: only plots they're actively assigned to.
export async function assertCanAccessPlot(
  role: UserRole,
  userId: string,
  plotId: string,
  findAccessiblePlot: FindAccessiblePlot = async (where) =>
    prisma.plot.findFirst({
      where,
      select: { id: true },
    })
): Promise<boolean> {
  const plot = await findAccessiblePlot(
    buildDirectPlotAccessWhere(role, userId, plotId)
  );
  return !!plot;
}
