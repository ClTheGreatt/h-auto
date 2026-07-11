import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAlertSuggestion, type AlertSuggestion } from "@/lib/alerts/suggestions";
import { sendAlertNotifications } from "@/lib/alerts/processor";

// No reading within this window → device considered offline
const OFFLINE_THRESHOLD_MINUTES = 30;
// Offline for longer than this bumps the alert from WARNING to CRITICAL
const CRITICAL_OFFLINE_MINUTES = 120;

function formatElapsed(ms: number): string {
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = {
    stagesAdvanced: 0,
    devicesMarkedOffline: 0,
    offlineAlertsCreated: 0,
  };

  // ===== #5 Auto growth-stage progression =====
  const plots = await prisma.plot.findMany({
    where: {
      status: { in: ["PLANTED", "GROWING"] },
      cropId: { not: null },
      plantingDate: { not: null },
    },
    include: {
      crop: { include: { stages: { orderBy: { orderIndex: "asc" } } } },
    },
  });

  for (const plot of plots) {
    if (!plot.crop || !plot.plantingDate || plot.crop.stages.length === 0) continue;

    const elapsedDays = Math.floor(
      (now.getTime() - plot.plantingDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Find the stage the plot should be in based on cumulative stage durations
    let cumulative = 0;
    let targetStage = plot.crop.stages[0];
    let pastAllStages = true;
    for (const stage of plot.crop.stages) {
      cumulative += stage.durationDays;
      targetStage = stage;
      if (elapsedDays < cumulative) {
        pastAllStages = false;
        break;
      }
    }

    const data: { currentStageId?: string; status?: "READY_FOR_HARVEST" } = {};
    if (plot.currentStageId !== targetStage.id) data.currentStageId = targetStage.id;
    if (pastAllStages && plot.status !== "READY_FOR_HARVEST") {
      data.status = "READY_FOR_HARVEST";
    }
    if (Object.keys(data).length > 0) {
      await prisma.plot.update({ where: { id: plot.id }, data });
      if (data.currentStageId) result.stagesAdvanced++;
    }
  }

  // ===== #6 Device offline detection =====
  const cutoff = new Date(now.getTime() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000);
  const staleDevices = await prisma.device.findMany({
    where: {
      status: "ONLINE",
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
    },
    select: {
      id: true,
      deviceCode: true,
      plotId: true,
      lastSeenAt: true,
      plot: { select: { name: true } },
    },
  });

  for (const device of staleDevices) {
    await prisma.device.update({
      where: { id: device.id },
      data: { status: "OFFLINE" },
    });
    result.devicesMarkedOffline++;

    const existing = await prisma.alert.findFirst({
      where: { plotId: device.plotId, type: "DEVICE_OFFLINE", resolved: false },
    });
    if (!existing) {
      let suggestion: AlertSuggestion | null = null;
      try {
        suggestion = buildAlertSuggestion({ type: "DEVICE_OFFLINE" });
      } catch (err) {
        console.warn("[cron/daily] suggestion builder failed:", err);
      }

      const staleDurationMs = device.lastSeenAt
        ? now.getTime() - device.lastSeenAt.getTime()
        : Infinity;
      const severity =
        staleDurationMs > CRITICAL_OFFLINE_MINUTES * 60 * 1000
          ? "CRITICAL"
          : "WARNING";
      const elapsedPhrase = device.lastSeenAt
        ? `for ${formatElapsed(staleDurationMs)}`
        : "since it was registered";
      const message = `Device ${device.deviceCode} has not reported readings ${elapsedPhrase}. Check that the device has power, is within WiFi range, and the WiFi network is 2.4GHz.`;

      const alert = await prisma.alert.create({
        data: {
          plotId: device.plotId,
          type: "DEVICE_OFFLINE",
          severity,
          message,
          suggestionTitle: suggestion?.title ?? null,
          suggestionSteps: suggestion?.steps ?? [],
        },
      });
      result.offlineAlertsCreated++;

      try {
        const assignments = await prisma.plotAssignment.findMany({
          where: { plotId: device.plotId, status: "ACTIVE" },
          include: { student: true, faculty: true },
        });
        const recipientMap = new Map<string, (typeof assignments)[number]["student"]>();
        for (const a of assignments) {
          recipientMap.set(a.student.id, a.student);
          recipientMap.set(a.faculty.id, a.faculty);
        }

        await sendAlertNotifications(alert, Array.from(recipientMap.values()), {
          plotId: device.plotId,
          plotName: device.plot.name,
          alertType: "DEVICE_OFFLINE",
          severity,
          message,
          suggestion,
        });
      } catch (err) {
        console.warn("[cron/daily] device-offline notification failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true, ranAt: now.toISOString(), ...result });
}