import Link from "next/link";
import {
  Activity,
  BellRing,
  TrendingUp,
  Sprout,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { TimeRangePicker } from "@/components/analytics/time-range-picker";
import { StatCard } from "@/components/analytics/stat-card";
import { AlertsByTypeChart } from "@/components/analytics/alerts-by-type-chart";
import { SensorTrendsChart } from "@/components/analytics/sensor-trends-chart";
import { AlertsOverTimeChart } from "@/components/analytics/alerts-over-time-chart";
import { SensorLineChart } from "@/components/analytics/sensor-line-chart";
import { PlotFilter } from "@/components/analytics/plot-filter";
import {
  getDateFromRange,
  parseRange,
} from "@/lib/analytics/time-range";
import {
  calculateOptimalPercent,
  ALERT_TYPE_LABELS,
} from "@/lib/analytics/aggregator";

type RawReading = {
  recordedAt: Date;
  soilMoisture: number | null;
  temperature: number | null;
  humidity: number | null;
  lightIntensity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
};

type RawAlert = {
  createdAt: Date;
  severity: "INFO" | "WARNING" | "CRITICAL";
  resolved: boolean;
  type: string;
};

function aggregateSensorReadings(
  readings: RawReading[],
  since: Date | null,
  now: Date
) {
  if (readings.length === 0) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const rangeMs =
    now.getTime() - (since?.getTime() ?? readings[0].recordedAt.getTime());
  const totalDays = rangeMs / dayMs;
  const bucketSize = totalDays <= 1 ? 60 * 60 * 1000 : dayMs;

  type Bucket = {
    time: number;
    moistureSum: number; moistureCount: number;
    tempSum: number; tempCount: number;
    humSum: number; humCount: number;
    lightSum: number; lightCount: number;
    nSum: number; nCount: number;
    pSum: number; pCount: number;
    kSum: number; kCount: number;
  };

  const buckets = new Map<number, Bucket>();

  for (const r of readings) {
    const time = new Date(r.recordedAt).getTime();
    const bucket = Math.floor(time / bucketSize) * bucketSize;

    if (!buckets.has(bucket)) {
      buckets.set(bucket, {
        time: bucket,
        moistureSum: 0, moistureCount: 0,
        tempSum: 0, tempCount: 0,
        humSum: 0, humCount: 0,
        lightSum: 0, lightCount: 0,
        nSum: 0, nCount: 0,
        pSum: 0, pCount: 0,
        kSum: 0, kCount: 0,
      });
    }

    const b = buckets.get(bucket)!;
    if (r.soilMoisture !== null) { b.moistureSum += r.soilMoisture; b.moistureCount++; }
    if (r.temperature !== null) { b.tempSum += r.temperature; b.tempCount++; }
    if (r.humidity !== null) { b.humSum += r.humidity; b.humCount++; }
    if (r.lightIntensity !== null) { b.lightSum += r.lightIntensity; b.lightCount++; }
    if (r.nitrogen !== null) { b.nSum += r.nitrogen; b.nCount++; }
    if (r.phosphorus !== null) { b.pSum += r.phosphorus; b.pCount++; }
    if (r.potassium !== null) { b.kSum += r.potassium; b.kCount++; }
  }

  const avg = (sum: number, count: number) =>
    count > 0 ? Math.round((sum / count) * 10) / 10 : null;

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((b) => ({
      time: b.time,
      label: new Date(b.time).toLocaleString(
        "en-US",
        bucketSize < dayMs
          ? { hour: "numeric", hour12: true }
          : { month: "short", day: "numeric" }
      ),
      moisture: avg(b.moistureSum, b.moistureCount),
      temperature: avg(b.tempSum, b.tempCount),
      humidity: avg(b.humSum, b.humCount),
      light: avg(b.lightSum, b.lightCount),
      nitrogen: avg(b.nSum, b.nCount),
      phosphorus: avg(b.pSum, b.pCount),
      potassium: avg(b.kSum, b.kCount),
    }));
}

function aggregateAlertsByDate(alerts: RawAlert[]) {
  if (alerts.length === 0) return [];

  const buckets = new Map<
    number,
    { date: number; critical: number; warning: number; info: number }
  >();

  for (const a of alerts) {
    const date = new Date(a.createdAt);
    date.setHours(0, 0, 0, 0);
    const key = date.getTime();

    if (!buckets.has(key)) {
      buckets.set(key, { date: key, critical: 0, warning: 0, info: 0 });
    }

    const b = buckets.get(key)!;
    if (a.severity === "CRITICAL") b.critical++;
    else if (a.severity === "WARNING") b.warning++;
    else b.info++;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.date - b.date)
    .map((b) => ({
      label: new Date(b.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      critical: b.critical,
      warning: b.warning,
      info: b.info,
    }));
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; plotId?: string }>;
}) {
  const session = await requireAuth();
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const since = getDateFromRange(range);
  const role = session.user.role;
  const selectedPlotId = sp.plotId;

  // Role-aware base filter
  const plotFilter =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : {};

  // Combined filter (role + selected plot)
  const combinedPlotFilter = selectedPlotId
    ? { ...plotFilter, id: selectedPlotId }
    : plotFilter;

  // Fetch plots for dropdown (always all role-visible plots)
  const plots = await prisma.plot.findMany({
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
  });

  // Fetch summary data scoped to filter
  const [totalReadings, alerts, totalLogs, allReadings] = await Promise.all([
    prisma.sensorReading.count({
      where: {
        ...(since && { recordedAt: { gte: since } }),
        plot: combinedPlotFilter,
      },
    }),
    prisma.alert.findMany({
      where: {
        ...(since && { createdAt: { gte: since } }),
        plot: combinedPlotFilter,
      },
      select: {
        createdAt: true,
        severity: true,
        resolved: true,
        type: true,
      },
    }),
    prisma.growthLog.count({
      where: {
        ...(since && { createdAt: { gte: since } }),
        plot: combinedPlotFilter,
      },
    }),
    prisma.sensorReading.findMany({
      where: {
        ...(since && { recordedAt: { gte: since } }),
        plot: combinedPlotFilter,
      },
     orderBy: { recordedAt: "asc" },
      take: 2000,
      select: {
        recordedAt: true,
        soilMoisture: true,
        temperature: true,
        humidity: true,
        lightIntensity: true,
        nitrogen: true,
        phosphorus: true,
        potassium: true,
      },
    }),
  ]);

  const openAlerts = alerts.filter((a) => !a.resolved).length;
  const criticalAlerts = alerts.filter(
    (a) => !a.resolved && a.severity === "CRITICAL"
  ).length;

   const sensorTrends = aggregateSensorReadings(allReadings, since, new Date());
  const alertsByDate = aggregateAlertsByDate(alerts);

  const lightSeries = [
    {
      key: "light",
      label: "Light",
      color: "#f59e0b",
      data: sensorTrends.map((t) => ({ recordedAt: new Date(t.time), value: t.light })),
    },
  ];
  const npkSeries = [
    { key: "nitrogen", label: "Nitrogen", color: "#16a34a", data: sensorTrends.map((t) => ({ recordedAt: new Date(t.time), value: t.nitrogen })) },
    { key: "phosphorus", label: "Phosphorus", color: "#a855f7", data: sensorTrends.map((t) => ({ recordedAt: new Date(t.time), value: t.phosphorus })) },
    { key: "potassium", label: "Potassium", color: "#ea580c", data: sensorTrends.map((t) => ({ recordedAt: new Date(t.time), value: t.potassium })) },
  ];

  // Group alerts by type
  const alertTypeCounts = new Map<
    string,
    {
      type: string;
      label: string;
      count: number;
      severity: "WARNING" | "CRITICAL" | "INFO";
    }
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

  // Plot health per plot
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

  const selectedPlot = plots.find((p) => p.id === selectedPlotId);
  const plotCount = selectedPlotId ? 1 : plots.length;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedPlot
              ? `Detailed insights for ${selectedPlot.name}.`
              : "System-wide insights and trends across all plots."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PlotFilter
            plots={plots.map((p) => ({ id: p.id, name: p.name }))}
            current={selectedPlotId}
          />
          <TimeRangePicker current={range} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={selectedPlot ? "Selected plot" : "Plots"}
          value={plotCount}
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
            criticalAlerts > 0
              ? `${criticalAlerts} critical`
              : openAlerts > 0
              ? "all warning"
              : "all clear"
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

      {/* Sensor trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sensor trends</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Average soil moisture, temperature, and humidity over time
            {selectedPlot && ` for ${selectedPlot.name}`}.
          </p>
        </CardHeader>
        <CardContent>
          {sensorTrends.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              No sensor data in this range.
            </div>
          ) : (
            <SensorTrendsChart data={sensorTrends} />
          )}
        </CardContent>
      </Card>

     {/* Light + NPK trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Light intensity</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Average light intensity over time.
            </p>
          </CardHeader>
          <CardContent>
            {sensorTrends.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No sensor data in this range.
              </div>
            ) : (
              <SensorLineChart series={lightSeries} range={range} unit=" lux" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nutrients (NPK)</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Average nitrogen, phosphorus, and potassium over time.
            </p>
          </CardHeader>
          <CardContent>
            {sensorTrends.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No sensor data in this range.
              </div>
            ) : (
              <SensorLineChart series={npkSeries} range={range} unit=" mg/kg" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts over time</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Daily alert count by severity.
            </p>
          </CardHeader>
          <CardContent>
            {alertsByDate.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No alerts in this range.
              </div>
            ) : (
              <AlertsOverTimeChart data={alertsByDate} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts by type</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Breakdown by sensor type and severity.
            </p>
          </CardHeader>
          <CardContent>
            <AlertsByTypeChart data={Array.from(alertTypeCounts.values())} />
          </CardContent>
        </Card>
      </div>

      {/* Plot health summary - inline filtering, no redirects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plot health summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            {selectedPlot ? (
              <>
                Showing one plot.{" "}
                <Link
                  href={`/dashboard/analytics?range=${range}`}
                  className="text-green-600 hover:underline"
                >
                  Clear filter to see all
                </Link>
              </>
            ) : (
              "Click a plot to filter this entire page to its data."
            )}
          </p>
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
                const isSelected = plot.id === selectedPlotId;

                return (
                  <Link
                    key={plot.id}
                    href={`/dashboard/analytics?plotId=${plot.id}&range=${range}`}
                    className={
                      "flex items-center gap-4 p-4 transition " +
                      (isSelected
                        ? "bg-green-50 hover:bg-green-100"
                        : "hover:bg-gray-50")
                    }
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
                        {isSelected && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-blue-100 text-blue-700"
                          >
                            Filtered
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {plot.location ?? "No location"} •{" "}
                        {plot._count.alerts > 0
                          ? `${plot._count.alerts} open alert${plot._count.alerts === 1 ? "" : "s"}`
                          : "No open alerts"}{" "}
                        • {plot._count.growthLogs} log
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