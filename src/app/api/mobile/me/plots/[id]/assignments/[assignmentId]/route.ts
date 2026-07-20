import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";

function isFacultyOrAdmin(role: string) {
  return role === "FACULTY" || role === "ADMIN" || role === "SUPER_ADMIN";
}

// DELETE /api/mobile/me/plots/[id]/assignments/[assignmentId] — unassign a
// student from a plot. Mirrors src/actions/assignments.ts's
// removeAssignment: soft-remove (status=COMPLETED + endedAt), not a hard
// delete, so assignment history is preserved.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFacultyOrAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: plotId, assignmentId } = await params;

  try {
    if (user.role === "FACULTY") {
      const hasAccess = await canFacultyAccessPlot(user.id, plotId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // ADMIN/SUPER_ADMIN: no extra check

    const assignment = await prisma.plotAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (assignment.plotId !== plotId) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    await prisma.plotAssignment.update({
      where: { id: assignmentId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mobile/assignments DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to remove assignment" },
      { status: 500 }
    );
  }
}
