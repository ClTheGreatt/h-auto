import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { buildAssignableStudentsWhere } from "@/lib/students/assignable-students";

// GET /api/mobile/me/plots/[id]/assignable-students — candidates for the
// "Assign student" picker on this plot. A dedicated endpoint rather than
// widening GET /api/mobile/me/users, which also backs the admin Users
// directory and must stay admin-only.
//
// Authorization mirrors canManageAssignments in
// src/app/api/mobile/me/plots/[id]/route.ts (ADMIN/SUPER_ADMIN: any plot;
// FACULTY: only the plot they advise; everyone else: 403) but is
// reimplemented inline here rather than reusing assertCanAccessPlot, which
// also grants a STUDENT_FARMER access to a plot they're actively assigned
// to — this endpoint must reject STUDENT_FARMER unconditionally. The two
// copies of this check can drift; if that happens, extract a shared
// canManageAssignmentsForPlot(role, userId, plot) helper.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: plotId } = await params;

  try {
    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      select: { id: true, facultyId: true },
    });
    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }

    const canManageAssignments =
      user.role === "ADMIN" || user.role === "SUPER_ADMIN"
        ? true
        : user.role === "FACULTY"
          ? plot.facultyId === user.id
          : false;

    if (!canManageAssignments) {
      return NextResponse.json(
        { error: "You don't have access to this plot" },
        { status: 403 }
      );
    }

    const students = await prisma.user.findMany({
      where: await buildAssignableStudentsWhere({
        role: user.role,
        userId: user.id,
      }),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        course: true,
        yearLevel: true,
        section: true,
        profileImage: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error("[mobile/assignable-students] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignable students" },
      { status: 500 }
    );
  }
}
