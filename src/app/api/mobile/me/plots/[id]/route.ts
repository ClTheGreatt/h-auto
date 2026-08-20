import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { assertCanAccessPlot } from "@/lib/auth/plot-access";
import { getDeviceFreshness, isDeviceOnline } from "@/lib/utils/device-status";
import { buildOperationalAlertWhere } from "@/lib/alerts/scope";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const actor = { role: user.role, userId: user.id };

  try {
    // Role-based access check
    const hasAccess = await assertCanAccessPlot(user.role, user.id, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this plot" },
        { status: 403 }
      );
    }

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
        facultyId: true,
        adviser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        crop: {
          select: {
            id: true,
            name: true,
            variety: true,
            daysToHarvest: true,
            cultivationGuide: true,
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
            alerts: { where: buildOperationalAlertWhere(actor) },
          },
        },
      },
    });

    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }
    if (plot.status === "ARCHIVED" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
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

    // Computed from the shared runtime policy rather than trusting the stored
    // status, which is only refreshed periodically by the offline cron.
    const now = new Date();
    const deviceFreshness = plot.device
      ? getDeviceFreshness(plot.device.lastSeenAt, now)
      : null;
    const deviceOnline = isDeviceOnline(plot.device?.lastSeenAt, now);

    // Faculty may only manage assignments on the plot they advise; Admin/
    // Super Admin manage any plot; Students never manage assignments.
    const canManageAssignments =
      user.role === "ADMIN" || user.role === "SUPER_ADMIN"
        ? true
        : user.role === "FACULTY"
          ? plot.facultyId === user.id
          : false;

    // Fetch recent observations
const observations = await prisma.growthLog.findMany({
  where: { plotId: id },
  orderBy: { createdAt: "desc" },
  take: 5,
  select: {
    id: true,
    plantHeightCm: true,
    leafCount: true,
    soilMoisture: true,
    temperature: true,
    humidity: true,
    lightIntensity: true,
    nitrogen: true,
    phosphorus: true,
    potassium: true,
    observations: true,
    notes: true,
    createdAt: true,
    user: {
      select: {
        id: true,
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
        adviser: plot.adviser,
        canManageAssignments,
        device: plot.device
          ? {
              ...plot.device,
              lastSeenAt: plot.device.lastSeenAt?.toISOString() ?? null,
            }
          : null,
        deviceOnline,
        deviceFreshness: deviceFreshness?.state ?? null,
        deviceStale: deviceFreshness?.state === "STALE",
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
