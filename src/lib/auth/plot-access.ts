import { prisma } from "@/lib/prisma";

// Faculty are only scoped to plots they actively advise, unlike
// ADMIN/SUPER_ADMIN which have unrestricted access. Mirrors the ownership
// check already correctly enforced by the mobile API's plot detail route.
export async function canFacultyAccessPlot(
  userId: string,
  plotId: string
): Promise<boolean> {
  const assignment = await prisma.plotAssignment.findFirst({
    where: {
      plotId,
      facultyId: userId,
      status: "ACTIVE",
    },
  });
  return !!assignment;
}
