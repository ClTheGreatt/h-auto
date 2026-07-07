"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function getObservationsForDate(
  bucketStart: number,
  bucketMs: number,
  plotId?: string
) {
  const session = await requireAuth();
  const role = session.user.role;

  const plotFilter =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : {};
  const combinedPlotFilter = plotId ? { ...plotFilter, id: plotId } : plotFilter;

  const logs = await prisma.growthLog.findMany({
    where: {
      createdAt: {
        gte: new Date(bucketStart),
        lt: new Date(bucketStart + bucketMs),
      },
      plot: combinedPlotFilter,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      observations: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
      plot: { select: { id: true, name: true } },
      stage: { select: { name: true } },
    },
  });

  // day string sa Asia/Manila para sa Monitoring drill-down link
  const dayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(bucketStart));

  return logs.map((l) => ({
    id: l.id,
    observations: l.observations,
    createdAt: l.createdAt.toISOString(),
    userName: `${l.user.firstName} ${l.user.lastName}`,
    plotName: l.plot.name,
    plotId: l.plot.id,
    stageName: l.stage?.name ?? null,
    day: dayStr,
  }));
}
