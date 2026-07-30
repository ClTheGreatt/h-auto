import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";
import { parseOptionalPlotIdPageValue } from "@/lib/auth/plot-id";

export function plotScopeFilter(
  role: UserRole,
  userId: string,
  plotId?: string
) {
  const parsedPlotId = parseOptionalPlotIdPageValue(plotId);
  return buildAccessiblePlotWhere(
    { role, userId },
    parsedPlotId.kind === "valid"
      ? { id: parsedPlotId.plotId }
      : parsedPlotId.kind === "invalid"
        ? { id: { in: [] } }
        : {}
  );
}

export async function findGrowthLogsInBucket(params: {
  role: UserRole;
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
