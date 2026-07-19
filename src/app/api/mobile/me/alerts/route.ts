import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

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

    const alerts = await prisma.alert.findMany({
      where: { plotId: { in: plotIds } },
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