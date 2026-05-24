import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

type Range = "24h" | "7d" | "30d" | "all";
type Granularity = "hour" | "day" | "month";
type Bucket = { key: string; label: string };
type ReadingField =
  | "soilMoisture"
  | "temperature"
  | "humidity"
  | "lightIntensity"
  | "nitrogen"
  | "phosphorus"
  | "potassium";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const rangeParam = sp.get("range");
    const range: Range =
      rangeParam === "24h" || rangeParam === "30d" || rangeParam === "all"
        ? rangeParam
        : "7d";
    const plotIdParam = sp.get("plotId");

    // Resolve accessible plots
    let plotFilter = {};
    if (user.role === "STUDENT_FARMER") {
      plotFilter = {
        assignments: { some: { studentId: user.id, status: "ACTIVE" } },
      };
    } else if (user.role === "FACULTY") {
      plotFilter = {
        assignments: { some: { facultyId: user.id, status: "ACTIVE" } },
      };
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

    const { startDate, buckets, granularity } = await buildBuckets(
      range,
      plotIds
    );
    const keyOf = (d: Date) => bucketKey(d, granularity);

    if (plotIds.length === 0) {
      const emptyAvg = buckets.map((b) => ({ label: b.label, value: null }));
      const emptyCount = buckets.map((b) => ({ label: b.label, value: 0 }));
      const emptyAlerts = buckets.map((b) => ({
        label: b.label,
        critical: 0,
        warning: 0,
        info: 0,
      }));
      return NextResponse.json({
        range,
        summary: emptySummary(),
        observationsByDay: emptyCount,
        soilMoistureByDay: emptyAvg,
        temperatureByDay: emptyAvg,
        humidityByDay: emptyAvg,
        lightByDay: emptyAvg,
        nitrogenByDay: emptyAvg,
        phosphorusByDay: emptyAvg,
        potassiumByDay: emptyAvg,
        alertsByDay: emptyAlerts,
        statusDistribution,
      });
    }

    const readingWhere: {
      plotId: { in: string[] };
      recordedAt?: { gte: Date };
    } = { plotId: { in: plotIds } };
    const obsWhere: {
      plotId: { in: string[] };
      createdAt?: { gte: Date };
    } = { plotId: { in: plotIds } };
    const alertWhere: {
      plotId: { in: string[] };
      createdAt?: { gte: Date };
    } = { plotId: { in: plotIds } };
    if (startDate) {
      readingWhere.recordedAt = { gte: startDate };
      obsWhere.createdAt = { gte: startDate };
      alertWhere.createdAt = { gte: startDate };
    }

    const [readings, observations, alerts] = await Promise.all([
      prisma.sensorReading.findMany({
        where: readingWhere,
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
        where: obsWhere,
        select: { createdAt: true },
      }),
      prisma.alert.findMany({
        where: alertWhere,
        select: { createdAt: true, severity: true },
      }),
    ]);

    function bucketReadings(field: ReadingField) {
      const acc: Record<string, { sum: number; count: number }> = {};
      for (const r of readings) {
        const value = r[field];
        if (value === null) continue;
        const k = keyOf(r.recordedAt);
        if (!acc[k]) acc[k] = { sum: 0, count: 0 };
        acc[k].sum += value;
        acc[k].count++;
      }
      return buckets.map((b) => ({
        label: b.label,
        value: acc[b.key] ? acc[b.key].sum / acc[b.key].count : null,
      }));
    }

    function bucketCounts(items: { createdAt: Date }[]) {
      const acc: Record<string, number> = {};
      for (const item of items) {
        const k = keyOf(item.createdAt);
        acc[k] = (acc[k] ?? 0) + 1;
      }
      return buckets.map((b) => ({ label: b.label, value: acc[b.key] ?? 0 }));
    }

    function bucketAlerts() {
      const acc: Record<
        string,
        { critical: number; warning: number; info: number }
      > = {};
      for (const a of alerts) {
        const k = keyOf(a.createdAt);
        if (!acc[k]) acc[k] = { critical: 0, warning: 0, info: 0 };
        if (a.severity === "CRITICAL") acc[k].critical++;
        else if (a.severity === "WARNING") acc[k].warning++;
        else acc[k].info++;
      }
      return buckets.map((b) => ({
        label: b.label,
        critical: acc[b.key]?.critical ?? 0,
        warning: acc[b.key]?.warning ?? 0,
        info: acc[b.key]?.info ?? 0,
      }));
    }

    const avg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      return valid.length
        ? valid.reduce((a, b) => a + b, 0) / valid.length
        : null;
    };

    return NextResponse.json({
      range,
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
      observationsByDay: bucketCounts(observations),
      soilMoistureByDay: bucketReadings("soilMoisture"),
      temperatureByDay: bucketReadings("temperature"),
      humidityByDay: bucketReadings("humidity"),
      lightByDay: bucketReadings("lightIntensity"),
      nitrogenByDay: bucketReadings("nitrogen"),
      phosphorusByDay: bucketReadings("phosphorus"),
      potassiumByDay: bucketReadings("potassium"),
      alertsByDay: bucketAlerts(),
      statusDistribution,
    });
  } catch (error) {
    console.error("[mobile/me/analytics] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// ---- Bucketing: UTC-consistent so it works on ANY server timezone ----
// (this is the fix: bucket keys AND item keys are both derived from UTC,
// so items always land in a bucket and nothing disappears.)

function bucketKey(d: Date, granularity: Granularity) {
  const iso = d.toISOString(); // always UTC
  if (granularity === "hour") return iso.slice(0, 13); // YYYY-MM-DDTHH
  if (granularity === "month") return iso.slice(0, 7); // YYYY-MM
  return iso.slice(0, 10); // YYYY-MM-DD
}

async function buildBuckets(
  range: Range,
  plotIds: string[]
): Promise<{
  startDate: Date | null;
  buckets: Bucket[];
  granularity: Granularity;
}> {
  const now = new Date();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  // 24h -> hourly (UTC hour buckets)
  if (range === "24h") {
    const base = new Date(now);
    base.setUTCMinutes(0, 0, 0); // top of current UTC hour
    const buckets: Bucket[] = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(base.getTime() - i * HOUR);
      buckets.push({
        key: d.toISOString().slice(0, 13),
        label: d.toLocaleTimeString("en-US", { hour: "numeric" }),
      });
    }
    return { startDate: new Date(base.getTime() - 23 * HOUR), buckets, granularity: "hour" };
  }

  // all -> monthly (UTC month buckets) from earliest data to now = HISTORY
  if (range === "all") {
    let earliest: Date | null = null;
    if (plotIds.length) {
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
      const candidates = [r?.recordedAt, o?.createdAt, a?.createdAt].filter(
        (d): d is Date => !!d
      );
      if (candidates.length) {
        earliest = new Date(Math.min(...candidates.map((d) => d.getTime())));
      }
    }
    const anchor = earliest ?? now;
    const startMonth = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)
    );
    const buckets: Bucket[] = [];
    const cursor = new Date(startMonth);
    while (cursor.getTime() <= now.getTime()) {
      buckets.push({
        key: cursor.toISOString().slice(0, 7),
        label: cursor.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return { startDate: startMonth, buckets, granularity: "month" };
  }

  // 7d / 30d -> daily (UTC day buckets)
  const days = range === "30d" ? 30 : 7;
  const base = new Date(now);
  base.setUTCHours(0, 0, 0, 0); // start of current UTC day
  const buckets: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * DAY);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label:
        days <= 7
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
    });
  }
  return {
    startDate: new Date(base.getTime() - (days - 1) * DAY),
    buckets,
    granularity: "day",
  };
}

function emptySummary() {
  return {
    totalReadings: 0,
    totalObservations: 0,
    totalAlerts: 0,
    avgSoilMoisture: null,
    avgTemperature: null,
    avgHumidity: null,
    avgLightIntensity: null,
    avgNitrogen: null,
    avgPhosphorus: null,
    avgPotassium: null,
  };
}