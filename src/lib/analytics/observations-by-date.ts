import { prisma } from "@/lib/prisma";

export function plotScopeFilter(role: string, userId: string, plotId?: string) {
  const base =
    role === "STUDENT_FARMER"
      ? { assignments: { some: { studentId: userId, status: "ACTIVE" as const } } }
      : {};
  return plotId ? { ...base, id: plotId } : base;
}

export async function findGrowthLogsInBucket(params: {
  role: string;
  userId: string;
  bucketStart: number;
  bucketMs: number;
  plotId?: string;
}) {
  const { role, userId, bucketStart, bucketMs, plotId } = params;

  return prisma.growthLog.findMany({
    where: {
      createdAt: {
        gte: new Date(bucketStart),
        lt: new Date(bucketStart + bucketMs),
      },
      plot: plotScopeFilter(role, userId, plotId),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      observations: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
      plot: { select: { id: true, name: true } },
      stage: { select: { name: true } },
    },
  });
}
