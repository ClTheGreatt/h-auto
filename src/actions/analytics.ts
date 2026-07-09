"use server";

import { requireAuth } from "@/lib/auth-helpers";
import { findGrowthLogsInBucket } from "@/lib/analytics/observations-by-date";

export async function getObservationsForDate(
  bucketStart: number,
  bucketMs: number,
  plotId?: string
) {
  const session = await requireAuth();
  const role = session.user.role;

  const logs = await findGrowthLogsInBucket({
    role,
    userId: session.user.id,
    bucketStart,
    bucketMs,
    plotId,
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
