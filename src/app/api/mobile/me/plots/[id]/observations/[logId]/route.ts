import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

// DELETE /api/mobile/me/plots/[id]/observations/[logId] — delete a growth
// log entry. Mirrors src/actions/growth.ts's deleteGrowthLog exactly:
// author OR ADMIN/SUPER_ADMIN can delete (Faculty is NOT bypassed).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: plotId, logId } = await params;

  try {
    const log = await prisma.growthLog.findUnique({ where: { id: logId } });
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    // Defense against ID juggling — don't leak existence of logs on other plots.
    if (log.plotId !== plotId) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const isAuthor = log.userId === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to delete this log" },
        { status: 403 }
      );
    }

    // Prisma cascade handles GrowthImage; no Cloudinary cleanup — matching
    // web's existing gap, not fixing here.
    await prisma.growthLog.delete({ where: { id: logId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mobile/observations DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete log" },
      { status: 500 }
    );
  }
}
