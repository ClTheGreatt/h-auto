import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { findGrowthLogsInBucket } from "@/lib/analytics/observations-by-date";
import { assertCanAccessPlot } from "@/lib/auth/plot-access";
import { parseOptionalPlotIdSearchParams } from "@/lib/auth/plot-id";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const bucketStartParam = sp.get("bucketStart");
    const bucketMsParam = sp.get("bucketMs");
    const parsedPlotId = parseOptionalPlotIdSearchParams(sp);
    if (parsedPlotId.kind === "invalid") {
      return NextResponse.json({ error: "Invalid plotId" }, { status: 400 });
    }
    const plotId =
      parsedPlotId.kind === "valid" ? parsedPlotId.plotId : undefined;

    if (
      plotId !== undefined &&
      !(await assertCanAccessPlot(user.role, user.id, plotId))
    ) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }

    if (!bucketStartParam || !bucketMsParam) {
      return NextResponse.json(
        { error: "bucketStart and bucketMs are required" },
        { status: 400 }
      );
    }

    const bucketStart = new Date(bucketStartParam).getTime();
    const bucketMs = Number(bucketMsParam);

    if (Number.isNaN(bucketStart) || !Number.isFinite(bucketMs) || bucketMs <= 0) {
      return NextResponse.json(
        { error: "Invalid bucketStart or bucketMs" },
        { status: 400 }
      );
    }

    const logs = await findGrowthLogsInBucket({
      role: user.role,
      userId: user.id,
      bucketStart,
      bucketMs,
      plotId,
    });

    return NextResponse.json({
      day: formatDayLabel(bucketStart, bucketMs),
      logs: logs.map((l) => ({
        id: l.id,
        note: l.observations,
        createdAt: l.createdAt.toISOString(),
        stage: l.stage?.name ?? null,
        author: {
          id: l.user.id,
          name: `${l.user.firstName} ${l.user.lastName}`,
          image: l.user.profileImage,
        },
        plot: { id: l.plot.id, name: l.plot.name },
      })),
    });
  } catch (error) {
    console.error("[mobile/me/analytics/observations-by-date] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch observations" },
      { status: 500 }
    );
  }
}

function formatDayLabel(bucketStart: number, bucketMs: number) {
  const d = new Date(bucketStart);
  if (bucketMs < DAY) {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      timeZone: "Asia/Manila",
    }); // "Jul 6, 3 PM"
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }); // "Jul 6"
}
