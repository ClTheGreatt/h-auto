import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

const LIMIT = 50;
const DAY = 24 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const cursor = sp.get("cursor");
  const order: "asc" | "desc" = sp.get("order") === "asc" ? "asc" : "desc";
  const monthParam = sp.get("month");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;
  const range = sp.get("range");

  const access =
    user.role === "STUDENT_FARMER"
      ? { assignments: { some: { studentId: user.id, status: "ACTIVE" as const } } }
      : user.role === "FACULTY"
        ? { assignments: { some: { facultyId: user.id, status: "ACTIVE" as const } } }
        : {};

  const plot = await prisma.plot.findFirst({
    where: { id, ...access },
    select: { id: true },
  });
  if (!plot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let gte: Date | undefined;
  let lt: Date | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    gte = new Date(Date.UTC(y, m - 1, 1));
    lt = new Date(Date.UTC(y, m, 1));
  } else if (range === "7d") {
    gte = new Date(Date.now() - 7 * DAY);
  } else if (range === "30d") {
    gte = new Date(Date.now() - 30 * DAY);
  }
  const recordedAt =
    gte || lt ? { ...(gte && { gte }), ...(lt && { lt }) } : undefined;

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