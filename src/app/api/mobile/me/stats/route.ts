import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessiblePlotWhere = buildAccessiblePlotWhere({
      role: user.role,
      userId: user.id,
    });
    const plotsAssigned = await prisma.plot.count({
      where: accessiblePlotWhere,
    });

    const observationsCount = await prisma.growthLog.count({
      where: {
        userId: user.id,
        plot: accessiblePlotWhere,
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
