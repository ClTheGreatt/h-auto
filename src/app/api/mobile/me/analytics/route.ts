import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

type Range = "24h" | "7d" | "30d" | "all";
type Bucket = { key: string; label: string };
type Granularity = "hour" | "day";
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

    // Narrow to a specific plot if requested and accessible
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

    if (plotIds.length === 0) {
     const emptyAvg = buckets.map((b) => ({ label: b.label, value: null }));
      const emptyCount = buckets.map((b) => ({ label: b.label, value: 0 }));
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
    if (startDate) {
      readingWhere.recordedAt = { gte: startDate };
      obsWhere.createdAt = { gte: startDate };
    }

    const [readings, observations] = await Promise.all([
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
    ]);

    const keyOf = (d: Date) => bucketKey(d, granularity);

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
       value: acc[b.key] ? acc[b.key].sum / acc[b.key].count : 0,
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

function bucketKey(d: Date, granularity: Granularity) {
  const iso = d.toISOString();
  return granularity === "hour" ? iso.slice(0, 13) : iso.slice(0, 10);
}

async function buildBuckets(
  range: Range,
  plotIds: string[]
): Promise<{ startDate: Date | null; buckets: Bucket[]; granularity: Granularity }> {
  const now = new Date();

  // 24 hours → hourly buckets
  if (range === "24h") {
    const startDate = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    startDate.setMinutes(0, 0, 0);
    const buckets: Bucket[] = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      buckets.push({
        key: d.toISOString().slice(0, 13),
        label: d.toLocaleTimeString("en-US", { hour: "numeric" }),
      });
    }
    return { startDate, buckets, granularity: "hour" };
  }

  // Daily buckets
  let days = 7;
  if (range === "30d") days = 30;
  if (range === "all") {
    days = 30;
    if (plotIds.length) {
      const earliest = await prisma.sensorReading.findFirst({
        where: { plotId: { in: plotIds } },
        orderBy: { recordedAt: "asc" },
        select: { recordedAt: true },
      });
      if (earliest) {
        const diffDays =
          Math.ceil(
            (now.getTime() - earliest.recordedAt.getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1;
        days = Math.min(Math.max(diffDays, 7), 60);
      }
    }
  }

  const buckets: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label:
        days <= 7
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
    });
  }

  // "all" → don't bound the query (totals are all-time); chart shows recent buckets
  let startDate: Date | null = null;
  if (range !== "all") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, buckets, granularity: "day" };
}

function emptySummary() {
  return {
    totalReadings: 0,
    totalObservations: 0,
    avgSoilMoisture: null,
    avgTemperature: null,
    avgHumidity: null,
    avgLightIntensity: null,
    avgNitrogen: null,
    avgPhosphorus: null,
    avgPotassium: null,
  };
}