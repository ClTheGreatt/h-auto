import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Role-based plot access
    let whereClause = {};

    if (user.role === "STUDENT_FARMER") {
      whereClause = {
        assignments: {
          some: {
            studentId: user.id,
            status: "ACTIVE",
          },
        },
      };
    } else if (user.role === "FACULTY") {
      whereClause = {
        assignments: {
          some: {
            facultyId: user.id,
            status: "ACTIVE",
          },
        },
      };
    }
    // ADMIN and SUPER_ADMIN: see all plots (empty where = no filter)

    const plots = await prisma.plot.findMany({
      where: whereClause,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        plantingDate: true,
        expectedHarvest: true,
        crop: {
          select: { name: true },
        },
        _count: {
          select: {
            alerts: { where: { resolved: false } },
          },
        },
      },
    });

    // Shape response for mobile
    const shaped = plots.map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      status: p.status,
      cropName: p.crop?.name ?? null,
      plantingDate: p.plantingDate?.toISOString() ?? null,
      expectedHarvest: p.expectedHarvest?.toISOString() ?? null,
      openAlertsCount: p._count.alerts,
    }));

    return NextResponse.json({ plots: shaped });
  } catch (error) {
    console.error("[mobile/me/plots] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plots" },
      { status: 500 }
    );
  }
}

