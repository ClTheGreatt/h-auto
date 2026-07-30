import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";

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
  plotId: string
): Promise<boolean> {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;

  const plot = await prisma.plot.findFirst({
    where: buildAccessiblePlotWhere(
      { role, userId },
      { id: plotId }
    ),
    select: { id: true },
  });
  return !!plot;
}
