import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

type Range = "24h" | "7d" | "30d" | "all";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
    const plotIdParam = sp.get("plotId");
    const monthParam = sp.get("month");
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;

    let plotFilter: Record<string, unknown> = { status: { not: "ARCHIVED" } };
    if (user.role === "STUDENT_FARMER") {
      plotFilter = { ...plotFilter, assignments: { some: { studentId: user.id, status: "ACTIVE" } } };
    } else if (user.role === "FACULTY") {
      plotFilter = { ...plotFilter, facultyId: user.id };
    }

    const accessiblePlots = await prisma.plot.findMany({
      where: plotFilter,
      select: { id: true, status: true },
    });
    const targetPlots =
      plotIdParam && accessiblePlots.some((p) => p.id === plotIdParam)
        ? accessiblePlots.filter((p) => p.id === plotIdParam)
        : accessiblePlots;
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
    let bucketMs = DAY;

    if (month) {
      const [y, m] = month.split("-").map(Number);
      since = new Date(Date.UTC(y, m - 1, 1));
      until = new Date(Date.UTC(y, m, 1));
      bucketMs = DAY; // daily within the month
    } else if (range === "24h") {
      since = new Date(Date.now() - DAY);
      bucketMs = HOUR; // hourly — shows the time of day
    } else if (range === "7d") {
      since = new Date(Date.now() - 7 * DAY);
    } else if (range === "30d") {
      since = new Date(Date.now() - 30 * DAY);
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
  return bucketMs < DAY
    ? d.toLocaleTimeString("en-US", {
        hour: "numeric",
        timeZone: "Asia/Manila",
      }) // "5 PM" (Manila)
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
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

  const earliest = new Date(Math.min(...times));
  const now = new Date();
  const cur = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const months: string[] = [];
  while (cur <= end) {
    months.push(
      `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`
    );
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months.reverse(); // newest first
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
    const key = Math.floor(new Date(r.recordedAt).getTime() / bucketMs) * bucketMs;
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
    const key = Math.floor(new Date(d).getTime() / bucketMs) * bucketMs;
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
    const key = Math.floor(new Date(a.createdAt).getTime() / bucketMs) * bucketMs;
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