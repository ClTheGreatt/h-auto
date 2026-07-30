import { notFound } from "next/navigation";
import {
  Droplets,
  Thermometer,
  Cloud,
  Sun,
  Leaf,
  TrendingUp,
  BellRing,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { TimeRangePicker } from "@/components/analytics/time-range-picker";
import { StatCard } from "@/components/analytics/stat-card";
import { SensorLineChart } from "@/components/analytics/sensor-line-chart";
import { GrowthProgressionChart } from "@/components/analytics/growth-progression-chart";
import { AlertsByTypeChart } from "@/components/analytics/alerts-by-type-chart";
import { PlotHealthGauge } from "@/components/analytics/plot-health-gauge";
import { BackButton } from "@/components/analytics/back-button";
import {
  getDateFromRange,
  parseRange,
} from "@/lib/analytics/time-range";
import {
  calculateOptimalPercent,
  downsample,
  ALERT_TYPE_LABELS,
} from "@/lib/analytics/aggregator";
import { assertCanAccessPlot } from "@/lib/auth/plot-access";

export default async function PlotAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const since = getDateFromRange(range);
  const role = session.user.role;

  const hasAccess = await assertCanAccessPlot(role, session.user.id, id);
  if (!hasAccess) notFound();

  const plot = await prisma.plot.findUnique({
    where: { id },
    include: {
      crop: true,
      currentStage: true,
      assignments: {
        where: { status: "ACTIVE" },
        select: { studentId: true },
      },
    },
  });

  if (!plot) notFound();

  const readingsWhere = since
    ? { plotId: plot.id, recordedAt: { gte: since } }
    : { plotId: plot.id };

  const [rawReadings, growthLogs, alerts] = await Promise.all([
    prisma.sensorReading.findMany({
      where: readingsWhere,
      orderBy: { recordedAt: "asc" },
      take: 1000,
    }),
    prisma.growthLog.findMany({
      where: since
        ? { plotId: plot.id, createdAt: { gte: since } }
        : { plotId: plot.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.alert.findMany({
      where: since
        ? { plotId: plot.id, createdAt: { gte: since } }
        : { plotId: plot.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Downsample for chart performance
  const readings = downsample(rawReadings, 200);

  // Compute health %
  const healthPercent = calculateOptimalPercent(rawReadings, plot.currentStage);

  // Alert stats
  const openAlerts = alerts.filter((a) => !a.resolved).length;
  const resolvedAlerts = alerts.filter((a) => a.resolved).length;

  // Group alerts by type
  type AlertGroup = {
    type: string;
    label: string;
    count: number;
    severity: "WARNING" | "CRITICAL" | "INFO";
  };
  const alertTypeCounts = new Map<string, AlertGroup>();
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

  // Build sensor series
  const buildSeries = (
    key: "soilMoisture" | "temperature" | "humidity" | "lightIntensity" | "nitrogen" | "phosphorus" | "potassium",
    label: string,
    color: string
  ) => ({
    key,
    label,
    color,
    data: readings.map((r) => ({
      recordedAt: r.recordedAt,
      value: r[key] as number | null,
    })),
  });

  const stage = plot.currentStage;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <BackButton label={`Back to ${plot.name}`} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {plot.name} Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {plot.crop?.name ?? "No crop"} - {stage?.name ?? "No stage set"}
              {plot.location ? ` - ${plot.location}` : ""}
            </p>
          </div>
          <TimeRangePicker current={range} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Readings"
          value={rawReadings.length}
          icon={Activity}
          accent="blue"
        />
        <StatCard
          label="Open alerts"
          value={openAlerts}
          icon={BellRing}
          sublabel={`${resolvedAlerts} resolved`}
          accent={openAlerts > 0 ? "red" : "gray"}
        />
        <StatCard
          label="Growth logs"
          value={growthLogs.length}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Health"
          value={`${Math.round(healthPercent)}%`}
          icon={Leaf}
          sublabel="readings in optimal range"
          accent={
            healthPercent >= 80 ? "green" : healthPercent >= 50 ? "amber" : "red"
          }
        />
      </div>

      {/* Health gauge + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plot health</CardTitle>
          </CardHeader>
          <CardContent>
            <PlotHealthGauge optimalPercent={healthPercent} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Alerts by type</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertsByTypeChart data={Array.from(alertTypeCounts.values())} />
          </CardContent>
        </Card>
      </div>

      {/* Environment sensors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            Soil moisture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SensorLineChart
            series={[buildSeries("soilMoisture", "Soil moisture", "#3b82f6")]}
            range={range}
            unit="%"
            optimalMin={stage?.minSoilMoisture}
            optimalMax={stage?.maxSoilMoisture}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-red-500" />
              Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SensorLineChart
              series={[buildSeries("temperature", "Temperature", "#ef4444")]}
              range={range}
              unit="°C"
              optimalMin={stage?.minTemperature}
              optimalMax={stage?.maxTemperature}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-500" />
              Humidity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SensorLineChart
              series={[buildSeries("humidity", "Humidity", "#0ea5e9")]}
              range={range}
              unit="%"
              optimalMin={stage?.minHumidity}
              optimalMax={stage?.maxHumidity}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            Light intensity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SensorLineChart
            series={[buildSeries("lightIntensity", "Light", "#f59e0b")]}
            range={range}
            unit=" lux"
            optimalMin={stage?.minLightIntensity}
            optimalMax={stage?.maxLightIntensity}
          />
        </CardContent>
      </Card>

      {/* NPK combined */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-500" />
            Soil nutrients (NPK)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SensorLineChart
            series={[
              buildSeries("nitrogen", "Nitrogen (N)", "#22c55e"),
              buildSeries("phosphorus", "Phosphorus (P)", "#8b5cf6"),
              buildSeries("potassium", "Potassium (K)", "#ec4899"),
            ]}
            range={range}
            unit=" mg/kg"
          />
        </CardContent>
      </Card>

      {/* Growth progression */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Growth progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GrowthProgressionChart logs={growthLogs} range={range} />
        </CardContent>
      </Card>
    </div>
  );
}
