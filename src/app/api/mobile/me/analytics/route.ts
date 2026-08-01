import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";
import { resolveMobilePlotSelection } from "@/lib/analytics/mobile-plot-selection";
import { OPERATIONAL_PLOT_STATUSES } from "@/lib/plots/lifecycle";
import {
  DAY_MS,
  HOUR_MS,
  MANILA_TIME_ZONE,
  getAnalyticsDateFilter,
  getAnalyticsBucketStart,
  listAvailableManilaMonths,
  parseApiMonthValues,
} from "@/lib/analytics/manila-dates";

type Range = "24h" | "7d" | "30d" | "all";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const rp = sp.get("range");
    const range: Range =
      rp === "24h" || rp === "30d" || rp === "all" ? rp : "7d";
    const plotIdValues = sp.getAll("plotId");
    const monthValues = sp.getAll("month");
    const monthResult = parseApiMonthValues(monthValues);
    if (monthResult.kind === "invalid") {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    const parsedMonth =
      monthResult.kind === "valid" ? monthResult.month : null;
    const month = parsedMonth?.value ?? null;

    const selection = await resolveMobilePlotSelection(
      plotIdValues,
      (requestedPlotId) =>
        prisma.plot.findMany({
          where: buildAccessiblePlotWhere(
            { role: user.role, userId: user.id },
            // A specific plot explicitly requested (drilldown) resolves
            // regardless of lifecycle status EXCEPT archived — archived
            // means deliberately retired, so it stays unreachable even via
            // direct plotId. The lifecycle scope only applies to the "all
            // accessible plots" aggregate view.
            requestedPlotId !== undefined
              ? { id: requestedPlotId, status: { not: "ARCHIVED" } }
              : { status: { in: OPERATIONAL_PLOT_STATUSES } }
          ),
          select: { id: true, status: true },
        })
    );
    if (selection.kind === "error") {
      return NextResponse.json(
        {
          error:
            selection.status === 400 ? "Invalid plotId" : "Plot not found",
        },
        { status: selection.status }
      );
    }

    const targetPlots = selection.plots;
    const plotIds = targetPlots.map((p) => p.id);

    const statusDistribution: Record<string, number> = {};
    for (const p of targetPlots) {
      statusDistribution[p.status] = (statusDistribution[p.status] ?? 0) + 1;
    }

    // Available months for the picker (earliest data -> now)
    const availableMonths = await getAvailableMonths(plotIds);

    // Time window + bucket size
    let since: Date | null = null;
    let until: Date | null = null;
    let bucketMs = DAY_MS;

    const dateFilter = getAnalyticsDateFilter(parsedMonth, range);
    if (dateFilter) {
      since = dateFilter.gte;
      until = "lt" in dateFilter ? dateFilter.lt : null;
    }
    if (parsedMonth) {
      bucketMs = DAY_MS; // daily within the month
    } else if (range === "24h") {
      bucketMs = HOUR_MS; // hourly — shows the time of day
    } // all -> since null, daily

    const win = (() => {
      const w: { gte?: Date; lt?: Date } = {};
      if (since) w.gte = since;
      if (until) w.lt = until;
      return Object.keys(w).length ? w : null;
    })();

    if (plotIds.length === 0) {
      return NextResponse.json({
        range,
        month,
        availableMonths,
        bucketMs,
        summary: emptySummary(),
        observationsByDay: [],
        soilMoistureByDay: [],
        temperatureByDay: [],
        humidityByDay: [],
        lightByDay: [],
        nitrogenByDay: [],
        phosphorusByDay: [],
        potassiumByDay: [],
        alertsByDay: [],
        statusDistribution,
      });
    }

    const [readings, observations, alerts] = await Promise.all([
      prisma.sensorReading.findMany({
        where: { plotId: { in: plotIds }, ...(win ? { recordedAt: win } : {}) },
        orderBy: { recordedAt: "asc" },
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
      prisma.growthLog.findMany({
        where: { plotId: { in: plotIds }, ...(win ? { createdAt: win } : {}) },
        select: { createdAt: true },
      }),
      prisma.alert.findMany({
        where: { plotId: { in: plotIds }, ...(win ? { createdAt: win } : {}) },
        select: { createdAt: true, severity: true },
      }),
    ]);

    const trends = aggregateReadings(readings, bucketMs);
    const observationsByDay = aggregateCounts(observations.map((o) => o.createdAt), bucketMs);
    const alertsByDay = aggregateAlerts(alerts, bucketMs);

    const avg = (vals: (number | null)[]) => {
      const v = vals.filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };

    return NextResponse.json({
      range,
      month,
      availableMonths,
      bucketMs,
      summary: {
        totalReadings: readings.length,
        totalObservations: observations.length,
        totalAlerts: alerts.length,
        avgSoilMoisture: avg(readings.map((r) => r.soilMoisture)),
        avgTemperature: avg(readings.map((r) => r.temperature)),
        avgHumidity: avg(readings.map((r) => r.humidity)),
        avgLightIntensity: avg(readings.map((r) => r.lightIntensity)),
        avgNitrogen: avg(readings.map((r) => r.nitrogen)),
        avgPhosphorus: avg(readings.map((r) => r.phosphorus)),
        avgPotassium: avg(readings.map((r) => r.potassium)),
      },
      observationsByDay,
      soilMoistureByDay: trends.map((t) => ({ label: t.label, value: t.moisture })),
      temperatureByDay: trends.map((t) => ({ label: t.label, value: t.temperature })),
      humidityByDay: trends.map((t) => ({ label: t.label, value: t.humidity })),
      lightByDay: trends.map((t) => ({ label: t.label, value: t.light })),
      nitrogenByDay: trends.map((t) => ({ label: t.label, value: t.nitrogen })),
      phosphorusByDay: trends.map((t) => ({ label: t.label, value: t.phosphorus })),
      potassiumByDay: trends.map((t) => ({ label: t.label, value: t.potassium })),
      alertsByDay,
      statusDistribution,
    });
  } catch (e) {
    console.error("[mobile/me/analytics] error:", e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

function labelFor(time: number, bucketMs: number) {
  const d = new Date(time);
  return bucketMs < DAY_MS
    ? d.toLocaleTimeString("en-US", {
        hour: "numeric",
        timeZone: MANILA_TIME_ZONE,
      }) // "5 PM" (Manila)
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: MANILA_TIME_ZONE,
      }); // "May 16"
}

async function getAvailableMonths(plotIds: string[]): Promise<string[]> {
  if (plotIds.length === 0) return [];
  const [r, o, a] = await Promise.all([
    prisma.sensorReading.findFirst({
      where: { plotId: { in: plotIds } },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true },
    }),
    prisma.growthLog.findFirst({
      where: { plotId: { in: plotIds } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.alert.findFirst({
      where: { plotId: { in: plotIds } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const times = [r?.recordedAt, o?.createdAt, a?.createdAt]
    .filter((d): d is Date => !!d)
    .map((d) => d.getTime());
  if (times.length === 0) return [];

  return listAvailableManilaMonths(new Date(Math.min(...times)));
}

function aggregateReadings(
  readings: {
    recordedAt: Date;
    soilMoisture: number | null;
    temperature: number | null;
    humidity: number | null;
    lightIntensity: number | null;
    nitrogen: number | null;
    phosphorus: number | null;
    potassium: number | null;
  }[],
  bucketMs: number
) {
  type B = {
    time: number;
    mS: number; mC: number; tS: number; tC: number; hS: number; hC: number;
    lS: number; lC: number; nS: number; nC: number; pS: number; pC: number; kS: number; kC: number;
  };
  const buckets = new Map<number, B>();
  for (const r of readings) {
    const key = getAnalyticsBucketStart(r.recordedAt, bucketMs);
    if (!buckets.has(key)) {
      buckets.set(key, {
        time: key, mS: 0, mC: 0, tS: 0, tC: 0, hS: 0, hC: 0,
        lS: 0, lC: 0, nS: 0, nC: 0, pS: 0, pC: 0, kS: 0, kC: 0,
      });
    }
    const b = buckets.get(key)!;
    if (r.soilMoisture !== null) { b.mS += r.soilMoisture; b.mC++; }
    if (r.temperature !== null) { b.tS += r.temperature; b.tC++; }
    if (r.humidity !== null) { b.hS += r.humidity; b.hC++; }
    if (r.lightIntensity !== null) { b.lS += r.lightIntensity; b.lC++; }
    if (r.nitrogen !== null) { b.nS += r.nitrogen; b.nC++; }
    if (r.phosphorus !== null) { b.pS += r.phosphorus; b.pC++; }
    if (r.potassium !== null) { b.kS += r.potassium; b.kC++; }
  }
  const avg = (s: number, c: number) => (c > 0 ? Math.round((s / c) * 10) / 10 : null);
  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((b) => ({
      label: labelFor(b.time, bucketMs),
      moisture: avg(b.mS, b.mC),
      temperature: avg(b.tS, b.tC),
      humidity: avg(b.hS, b.hC),
      light: avg(b.lS, b.lC),
      nitrogen: avg(b.nS, b.nC),
      phosphorus: avg(b.pS, b.pC),
      potassium: avg(b.kS, b.kC),
    }));
}

function aggregateCounts(dates: Date[], bucketMs: number) {
  const buckets = new Map<number, number>();
  for (const d of dates) {
    const key = getAnalyticsBucketStart(d, bucketMs);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({
      label: labelFor(time, bucketMs),
      value,
      bucketStart: new Date(time).toISOString(),
    }));
}

function aggregateAlerts(alerts: { createdAt: Date; severity: string }[], bucketMs: number) {
  const buckets = new Map<number, { critical: number; warning: number; info: number }>();
  for (const a of alerts) {
    const key = getAnalyticsBucketStart(a.createdAt, bucketMs);
    if (!buckets.has(key)) buckets.set(key, { critical: 0, warning: 0, info: 0 });
    const b = buckets.get(key)!;
    if (a.severity === "CRITICAL") b.critical++;
    else if (a.severity === "WARNING") b.warning++;
    else b.info++;
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, b]) => ({
      label: labelFor(time, bucketMs),
      critical: b.critical,
      warning: b.warning,
      info: b.info,
    }));
}

function emptySummary() {
  return {
    totalReadings: 0, totalObservations: 0, totalAlerts: 0,
    avgSoilMoisture: null, avgTemperature: null, avgHumidity: null,
    avgLightIntensity: null, avgNitrogen: null, avgPhosphorus: null, avgPotassium: null,
  };
}
