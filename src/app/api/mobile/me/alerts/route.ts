import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import {
  buildHistoricalAlertWhere,
  buildOperationalAlertWhere,
} from "@/lib/alerts/scope";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const actor = { role: user.role, userId: user.id };
    const showResolved = req.nextUrl.searchParams.get("status") === "resolved";
    const where = showResolved
      ? buildHistoricalAlertWhere(actor)
      : buildOperationalAlertWhere(actor);

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        severity: true,
        message: true,
        resolved: true,
        resolvedAt: true,
        createdAt: true,
        suggestionTitle: true,
        suggestionSteps: true,
        plot: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      alerts: alerts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[mobile/me/alerts] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
