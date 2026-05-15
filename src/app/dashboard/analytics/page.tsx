import Link from "next/link";
import {
  Activity,
  BellRing,
  TrendingUp,
  Sprout,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { TimeRangePicker } from "@/components/analytics/time-range-picker";
import { StatCard } from "@/components/analytics/stat-card";
import { AlertsByTypeChart } from "@/components/analytics/alerts-by-type-chart";
import {
  getDateFromRange,
  parseRange,
} from "@/lib/analytics/time-range";
import {
  calculateOptimalPercent,
  ALERT_TYPE_LABELS,
} from "@/lib/analytics/aggregator";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAuth();
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const since = getDateFromRange(range);
  const role = session.user.role;

  const plotFilter =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : {};

  const [plots, totalReadings, alerts, totalLogs] = await Promise.all([
    prisma.plot.findMany({
      where: plotFilter,
      orderBy: { name: "asc" },
      include: {
        crop: { select: { name: true } },
        currentStage: true,
        _count: {
          select: {
            alerts: { where: { resolved: false } },
            growthLogs: true,
          },
        },
      },
    }),
    prisma.sensorReading.count({
      where: since
        ? { recordedAt: { gte: since }, plot: plotFilter }
        : { plot: plotFilter },
    }),
    prisma.alert.findMany({
      where: since
        ? { createdAt: { gte: since }, plot: plotFilter }
        : { plot: plotFilter },
    }),
    prisma.growthLog.count({
      where: since
        ? { createdAt: { gte: since }, plot: plotFilter }
        : { plot: plotFilter },
    }),
  ]);

  const openAlerts = alerts.filter((a) => !a.resolved).length;
  const criticalAlerts = alerts.filter(
    (a) => !a.resolved && a.severity === "CRITICAL"
  ).length;

  // Group alerts by type
  const alertTypeCounts = new Map<
    string,
    { type: string; label: string; count: number; severity: "WARNING" | "CRITICAL" | "INFO" }
  >();
  for (const a of alerts) {
    const existing = alertTypeCounts.get(a.type);
    if (existing) {
      existing.count++;
      if (a.severity === "CRITICAL") existing.severity = "CRITICAL";
    } else {
      alertTypeCounts.set(a.type, {
        type: a.type,
        label: ALERT_TYPE_LABELS[a.type] ?? a.type,
        count: 1,
        severity: a.severity,
      });
    }
  }

  // Calculate health per plot
  const plotHealth: Record<string, number> = {};
  for (const plot of plots) {
    if (!plot.currentStage) {
      plotHealth[plot.id] = 0;
      continue;
    }
    const readings = await prisma.sensorReading.findMany({
      where: since
        ? { plotId: plot.id, recordedAt: { gte: since } }
        : { plotId: plot.id },
      take: 200,
      orderBy: { recordedAt: "desc" },
    });
    plotHealth[plot.id] = calculateOptimalPercent(readings, plot.currentStage);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            System-wide insights, trends, and plot health overview.
          </p>
        </div>
        <TimeRangePicker current={range} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Plots"
          value={plots.length}
          icon={Sprout}
          accent="green"
        />
        <StatCard
          label="Sensor readings"
          value={totalReadings}
          icon={Activity}
          accent="blue"
        />
        <StatCard
          label="Open alerts"
          value={openAlerts}
          icon={BellRing}
          sublabel={
            criticalAlerts > 0 ? `${criticalAlerts} critical` : "all warning"
          }
          accent={openAlerts > 0 ? "red" : "gray"}
        />
        <StatCard
          label="Growth logs"
          value={totalLogs}
          icon={TrendingUp}
          accent="green"
        />
      </div>

      {/* Alerts breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts by type</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertsByTypeChart data={Array.from(alertTypeCounts.values())} />
        </CardContent>
      </Card>

      {/* Plot health table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plot health summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {plots.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              No plots to analyze.
            </div>
          ) : (
            <div className="divide-y">
              {plots.map((plot) => {
                const health = plotHealth[plot.id] ?? 0;
                const healthColor =
                  health >= 80
                    ? "text-green-700 bg-green-100"
                    : health >= 50
                    ? "text-amber-700 bg-amber-100"
                    : "text-red-700 bg-red-100";

                return (
                  <Link
                    key={plot.id}
                    href={`/dashboard/plots/${plot.id}/analytics`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{plot.name}</span>
                        {plot.crop && (
                          <Badge variant="secondary" className="text-xs">
                            {plot.crop.name}
                          </Badge>
                        )}
                        {plot.currentStage && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-green-100 text-green-700"
                          >
                            {plot.currentStage.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {plot.location ?? "No location"} -{" "}
                        {plot._count.alerts > 0
                          ? `${plot._count.alerts} open alert${plot._count.alerts === 1 ? "" : "s"}`
                          : "No open alerts"}
                        {" - "}
                        {plot._count.growthLogs} log
                        {plot._count.growthLogs === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={"font-mono " + healthColor}
                      >
                        {Math.round(health)}% optimal
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}