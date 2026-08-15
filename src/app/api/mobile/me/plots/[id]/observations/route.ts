import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { uploadToCloudinary } from "@/lib/cloudinary-server";
import { assertCanAccessPlot } from "@/lib/auth/plot-access";
import { validateImageFile } from "@/lib/upload-limits";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: plotId } = await context.params;

  try {
    // Access check
    const access = await assertCanAccessPlot(user.role, user.id, plotId);
    if (!access) {
      return NextResponse.json(
        { error: "You don't have access to this plot" },
        { status: 403 }
      );
    }

    // Parse multipart form
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const plantHeightCmRaw = formData.get("plantHeightCm") as string | null;
    const leafCountRaw = formData.get("leafCount") as string | null;
    const observations = formData.get("observations") as string | null;
    const notes = formData.get("notes") as string | null;
    const latitudeRaw = formData.get("latitude") as string | null;
    const longitudeRaw = formData.get("longitude") as string | null;
    const locationName = formData.get("locationName") as string | null;

    const plantHeightCm = plantHeightCmRaw
      ? parseFloat(plantHeightCmRaw)
      : null;
    const leafCount = leafCountRaw ? parseInt(leafCountRaw, 10) : null;

    // Get plot's current stage (for stageId) + status (for the harvest guard)
    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      select: { currentStageId: true, status: true },
    });
    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }
    if (plot.status === "HARVESTED") {
      return NextResponse.json(
        { error: "This plot is harvested. Unmark it to add growth logs." },
        { status: 409 }
      );
    }
    if (plot.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "This plot is archived. Restore it to add growth logs." },
        { status: 409 }
      );
    }

    // A photo is required for every observation.
    if (!image || image.size === 0) {
      return NextResponse.json(
        { error: "A photo is required to log an observation." },
        { status: 400 }
      );
    }

    const validationError = validateImageFile(image);
    if (validationError) {
      return NextResponse.json(
        { error: validationError.error },
        { status: validationError.status }
      );
    }

    let imageUrl: string;
    try {
      const buffer = Buffer.from(await image.arrayBuffer());
      const result = await uploadToCloudinary(buffer);
      imageUrl = result.url;
    } catch (err) {
      console.error("[observations] image upload failed:", err);
      return NextResponse.json(
        { error: "Failed to upload image. Try again." },
        { status: 500 }
      );
    }

    // Build observations text with GPS if available
 // Build observations text with location info
let observationText = observations?.trim() || "";
if (locationName) {
  // Prefer human-readable address
  const locLine = `📍 ${locationName}`;
  observationText = observationText
    ? `${observationText}\n\n${locLine}`
    : locLine;
} else if (latitudeRaw && longitudeRaw) {
  // Fallback to raw coords if no address available
  const lat = parseFloat(latitudeRaw).toFixed(6);
  const lng = parseFloat(longitudeRaw).toFixed(6);
  const gpsLine = `📍 ${lat}, ${lng}`;
  observationText = observationText
    ? `${observationText}\n\n${gpsLine}`
    : gpsLine;
}

    // Snapshot the plot's latest sensor reading (if any) onto this log
    const latestReading = await prisma.sensorReading.findFirst({
      where: { plotId },
      orderBy: { recordedAt: "desc" },
    });

    // Create GrowthLog + GrowthImage in a transaction
    const log = await prisma.$transaction(async (tx) => {
      const created = await tx.growthLog.create({
        data: {
          plotId,
          userId: user.id,
          stageId: plot.currentStageId,
          plantHeightCm,
          leafCount,
          soilMoisture: latestReading?.soilMoisture ?? null,
          temperature: latestReading?.temperature ?? null,
          humidity: latestReading?.humidity ?? null,
          lightIntensity: latestReading?.lightIntensity ?? null,
          nitrogen: latestReading?.nitrogen ?? null,
          phosphorus: latestReading?.phosphorus ?? null,
          potassium: latestReading?.potassium ?? null,
          sensorReadingId: latestReading?.id ?? null,
          observations: observationText || null,
          notes: notes?.trim() || null,
        },
      });

      await tx.growthImage.create({
        data: {
          growthLogId: created.id,
          imageUrl,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      observation: {
        id: log.id,
        createdAt: log.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[observations] error:", error);
    return NextResponse.json(
      { error: "Failed to create observation" },
      { status: 500 }
    );
  }
}