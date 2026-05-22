import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Role-based access check
    if (user.role === "STUDENT_FARMER") {
      const hasAccess = await prisma.plotAssignment.findFirst({
        where: {
          plotId: id,
          studentId: user.id,
          status: "ACTIVE",
        },
      });
      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to this plot" },
          { status: 403 }
        );
      }
    } else if (user.role === "FACULTY") {
      const hasAccess = await prisma.plotAssignment.findFirst({
        where: {
          plotId: id,
          facultyId: user.id,
          status: "ACTIVE",
        },
      });
      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to this plot" },
          { status: 403 }
        );
      }
    }
    // ADMIN / SUPER_ADMIN: no extra check

    // Fetch plot with relations
    const plot = await prisma.plot.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        plantingDate: true,
        expectedHarvest: true,
        sizeSqm: true,
        crop: {
          select: {
            id: true,
            name: true,
            variety: true,
            daysToHarvest: true,
          },
        },
        currentStage: {
          select: {
            id: true,
            name: true,
            orderIndex: true,
          },
        },
        device: {
          select: {
            deviceCode: true,
            status: true,
            lastSeenAt: true,
          },
        },
        _count: {
          select: {
            alerts: { where: { resolved: false } },
          },
        },
      },
    });

    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }

    // Fetch latest sensor reading (if any)
    const latestReading = await prisma.sensorReading.findFirst({
      where: { plotId: id },
      orderBy: { recordedAt: "desc" },
      select: {
        id: true,
        recordedAt: true,
        soilMoisture: true,
        temperature: true,
        humidity: true,
        lightIntensity: true,
        nitrogen: true,
        phosphorus: true,
        potassium: true,
      },
    });

    // Fetch recent observations
const observations = await prisma.growthLog.findMany({
  where: { plotId: id },
  orderBy: { createdAt: "desc" },
  take: 5,
  select: {
    id: true,
    plantHeightCm: true,
    leafCount: true,
    observations: true,
    notes: true,
    createdAt: true,
    user: {
      select: {
        firstName: true,
        lastName: true,
      },
    },
    stage: {
      select: {
        name: true,
      },
    },
    images: {                       // ← ADD THIS
      select: {
        imageUrl: true,
      },
    },
  },
});
    return NextResponse.json({
      plot: {
        id: plot.id,
        name: plot.name,
        location: plot.location,
        status: plot.status,
        sizeSqm: plot.sizeSqm,
        plantingDate: plot.plantingDate?.toISOString() ?? null,
        expectedHarvest: plot.expectedHarvest?.toISOString() ?? null,
        crop: plot.crop,
        currentStage: plot.currentStage,
        device: plot.device
          ? {
              ...plot.device,
              lastSeenAt: plot.device.lastSeenAt?.toISOString() ?? null,
            }
          : null,
        latestReading: latestReading
          ? {
              ...latestReading,
              recordedAt: latestReading.recordedAt.toISOString(),
            }
          : null,
        openAlertsCount: plot._count.alerts,
        observations: observations.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[mobile/me/plots/[id]] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plot details" },
      { status: 500 }
    );
  }
}