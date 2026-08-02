import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";
import { ACTIVITY_PLOT_STATUSES } from "@/lib/plots/lifecycle";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // "My Plots" / "Total Plots" on the Profile screen — an inventory
    // count, must match the Plots tab's "Active" filter and the mobile
    // dashboard's plot count, both scoped to ACTIVITY_PLOT_STATUSES.
    const activityPlotWhere = buildAccessiblePlotWhere(
      { role: user.role, userId: user.id },
      { status: { in: ACTIVITY_PLOT_STATUSES } }
    );
    const plotsAssigned = await prisma.plot.count({
      where: activityPlotWhere,
    });

    // "How many observations have I logged, ever" — a lifetime achievement
    // stat. Deliberately unscoped by lifecycle status: harvest is success,
    // not exit, so a plot being harvested must never make this count drop.
    const anyStatusAccessiblePlotWhere = buildAccessiblePlotWhere({
      role: user.role,
      userId: user.id,
    });
    const observationsCount = await prisma.growthLog.count({
      where: {
        userId: user.id,
        plot: anyStatusAccessiblePlotWhere,
      },
    });

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true, lastLoginAt: true },
    });

    const daysActive = fullUser
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - fullUser.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    return NextResponse.json({
      stats: {
        observations: observationsCount,
        plotsAssigned,
        daysActive,
        memberSince: fullUser?.createdAt?.toISOString() ?? null,
        lastLoginAt: fullUser?.lastLoginAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[mobile/me/stats] error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
