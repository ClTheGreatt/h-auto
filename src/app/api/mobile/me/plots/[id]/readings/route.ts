import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import {
  buildDirectPlotAccessWhere,
  isValidPlotId,
} from "@/lib/auth/plot-access";
import {
  getAnalyticsDateFilter,
  parseApiMonthValues,
} from "@/lib/analytics/manila-dates";

const LIMIT = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidPlotId(id)) {
    return NextResponse.json({ error: "Invalid plotId" }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const cursor = sp.get("cursor");
  const order: "asc" | "desc" = sp.get("order") === "asc" ? "asc" : "desc";
  const monthValues = sp.getAll("month");
  const monthResult = parseApiMonthValues(monthValues);
  if (monthResult.kind === "invalid") {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  const parsedMonth =
    monthResult.kind === "valid" ? monthResult.month : null;
  const range = sp.get("range");

  const plot = await prisma.plot.findFirst({
    where: buildDirectPlotAccessWhere(user.role, user.id, id),
    select: { id: true },
  });
  if (!plot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const recordedAt =
    parsedMonth || range === "7d" || range === "30d"
      ? getAnalyticsDateFilter(parsedMonth, range === "30d" ? "30d" : "7d") ??
        undefined
      : undefined;

  const rows = await prisma.sensorReading.findMany({
    where: { plotId: id, ...(recordedAt && { recordedAt }) },
    orderBy: { recordedAt: order },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

  const hasMore = rows.length > LIMIT;
  const items = hasMore ? rows.slice(0, LIMIT) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({
    readings: items.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() })),
    nextCursor,
  });
}
