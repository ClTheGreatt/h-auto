import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
    const plotIds = accessiblePlots.map((p) => p.id);

    // Status distribution
    const statusDistribution: Record<string, number> = {};
    for (const p of accessiblePlots) {
      statusDistribution[p.status] = (statusDistribution[p.status] ?? 0) + 1;
    }

    if (plotIds.length === 0) {
      return NextResponse.json({
        summary: {
          totalReadings: 0,
          totalObservations: 0,
          avgSoilMoisture: null,
          avgTemperature: null,
          avgHumidity: null,
            avgLightIntensity: null,
         avgNitrogen: null,
          avgPhosphorus: null,
          avgPotassium: null,
        },
         observationsByDay: emptyDays(),
         soilMoistureByDay: emptyDays(),
         temperatureByDay: emptyDays(),
         humidityByDay: emptyDays(),
         lightByDay: emptyDays(),
         nitrogenByDay: emptyDays(),
         phosphorusByDay: emptyDays(),
         potassiumByDay: emptyDays(),
         statusDistribution,
      });
    }

    // Last 7 days range (including today)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [readings, observations] = await Promise.all([
      prisma.sensorReading.findMany({
        where: {
          plotId: { in: plotIds },
          recordedAt: { gte: sevenDaysAgo },
        },
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
        where: {
          plotId: { in: plotIds },
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true },
      }),
    ]);

    // Build 7-day buckets
    const dayBuckets: { date: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dayBuckets.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }

    function bucketReadings(field: "soilMoisture" | "temperature" | "humidity" | "lightIntensity" | "nitrogen" | "phosphorus" | "potassium") {
      const buckets: Record<string, { sum: number; count: number }> = {};
      for (const r of readings) {
        const value = r[field];
        if (value === null) continue;
        const day = r.recordedAt.toISOString().slice(0, 10);
        if (!buckets[day]) buckets[day] = { sum: 0, count: 0 };
        buckets[day].sum += value;
        buckets[day].count++;
      }
      return dayBuckets.map((b) => ({
        label: b.label,
        value: buckets[b.date] ? buckets[b.date].sum / buckets[b.date].count : 0,
      }));
    }

    function bucketCounts(items: { createdAt: Date }[]) {
      const buckets: Record<string, number> = {};
      for (const item of items) {
        const day = item.createdAt.toISOString().slice(0, 10);
        buckets[day] = (buckets[day] ?? 0) + 1;
      }
      return dayBuckets.map((b) => ({
        label: b.label,
        value: buckets[b.date] ?? 0,
      }));
    }

    const avg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    return NextResponse.json({
      summary: {
        totalReadings: readings.length,
        totalObservations: observations.length,
        avgSoilMoisture: avg(readings.map((r) => r.soilMoisture)),
        avgTemperature: avg(readings.map((r) => r.temperature)),
        avgHumidity: avg(readings.map((r) => r.humidity)),
        avgLightIntensity: avg(readings.map((r) => r.lightIntensity)),
        avgNitrogen: avg(readings.map((r) => r.nitrogen)),
        avgPhosphorus: avg(readings.map((r) => r.phosphorus)),
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

function emptyDays() {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      value: 0,
    });
  }
  return result;
}