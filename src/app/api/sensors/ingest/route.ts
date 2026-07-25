import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sensorReadingSchema } from "@/lib/validations/device";
import { hashApiKey } from "@/lib/devices/hash-key";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const keyHash = hashApiKey(apiKey);
  let device = await prisma.device.findUnique({
    where: { apiKeyHash: keyHash },
    select: { id: true, plotId: true, status: true },
  });

  if (!device) {
    // Lazy migration fallback: devices registered before apiKeyHash existed
    // only have the plaintext apiKey set. Match on that, then backfill
    // apiKeyHash so the device's next request hits the hash path directly.
    // apiKey is slated for removal once every device is confirmed
    // backfilled and posting against the hash path.
    const plaintextMatch = await prisma.device.findUnique({
      where: { apiKey },
      select: { id: true, plotId: true, status: true },
    });
    if (plaintextMatch) {
      await prisma.device.update({
        where: { id: plaintextMatch.id },
        data: { apiKeyHash: keyHash },
      });
      device = plaintextMatch;
    }
  }

  if (!device) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const plot = await prisma.plot.findUnique({
    where: { id: device.plotId },
    select: { status: true },
  });
  if (!plot) {
    return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  }
  if (plot.status === "HARVESTED" || plot.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Plot is not active (harvested or archived); reading rejected." },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sensorReadingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sensor data", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const reading = await prisma.sensorReading.create({
    data: {
      deviceId: device.id,
      plotId: device.plotId,
      soilMoisture: parsed.data.soilMoisture ?? null,
      temperature: parsed.data.temperature ?? null,
      humidity: parsed.data.humidity ?? null,
      lightIntensity: parsed.data.lightIntensity ?? null,
      nitrogen: parsed.data.nitrogen ?? null,
      phosphorus: parsed.data.phosphorus ?? null,
      potassium: parsed.data.potassium ?? null,
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: { status: "ONLINE", lastSeenAt: new Date() },
  });

  // Fire-and-forget alert processing (don't block the ESP32 response)
  import("@/lib/alerts/processor").then(({ processSensorReading }) =>
    processSensorReading(reading.id).catch((err) =>
      console.error("Alert processing failed:", err)
    )
  );

  return NextResponse.json(
    { success: true, readingId: reading.id },
    { status: 201 }
  );
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "H-Auto sensor API" });
}