import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let plotFilter: Record<string, unknown> = { status: { not: "ARCHIVED" } };
    if (user.role === "STUDENT_FARMER") {
      plotFilter = {
        ...plotFilter,
        assignments: { some: { studentId: user.id, status: "ACTIVE" } },
      };
    } else if (user.role === "FACULTY") {
      plotFilter = {
        ...plotFilter,
        assignments: { some: { facultyId: user.id, status: "ACTIVE" } },
      };
    }

    const accessiblePlots = await prisma.plot.findMany({
      where: plotFilter,
      select: { id: true },
    });
    const plotIds = accessiblePlots.map((p) => p.id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [openAlertsCount, myObservationsCount, todaysObservationsCount, allUrgentAlerts, recentActivity] =
      await Promise.all([
        prisma.alert.count({
          where: { plotId: { in: plotIds }, resolved: false },
        }),
        prisma.growthLog.count({
          where: { userId: user.id },
        }),
        prisma.growthLog.count({
          where: {
            plotId: { in: plotIds },
            createdAt: { gte: todayStart },
          },
        }),
        prisma.alert.findMany({
          where: { plotId: { in: plotIds }, resolved: false },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            severity: true,
            message: true,
            createdAt: true,
            plot: { select: { id: true, name: true } },
          },
        }),
        prisma.growthLog.findMany({
          where: { plotId: { in: plotIds } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            observations: true,
            createdAt: true,
            plot: { select: { id: true, name: true } },
            user: { select: { firstName: true, lastName: true } },
            images: { take: 1, select: { imageUrl: true } },
          },
        }),
      ]);

    // Sort by severity then take top 3
    const urgentAlerts = allUrgentAlerts
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) -
          (SEVERITY_ORDER[b.severity] ?? 99)
      )
      .slice(0, 3);

    return NextResponse.json({
      stats: {
        plots: plotIds.length,
        openAlerts: openAlertsCount,
        myObservations: myObservationsCount,
        todaysObservations: todaysObservationsCount,
      },
      urgentAlerts: urgentAlerts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      recentActivity: recentActivity.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[mobile/me/dashboard] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}