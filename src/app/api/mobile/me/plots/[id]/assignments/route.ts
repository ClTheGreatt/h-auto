import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";

const assignBodySchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  notes: z.string().max(500).optional(),
});

function isFacultyOrAdmin(role: string) {
  return role === "FACULTY" || role === "ADMIN" || role === "SUPER_ADMIN";
}

// GET /api/mobile/me/plots/[id]/assignments — list active assignments for
// a plot. Admin/Super Admin see it unconditionally; Faculty only if they're
// the plot's adviser; a Student Farmer can see it only if they're
// themselves actively assigned to the same plot (so they can see their
// fellow students on it).
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
      select: { id: true },
    });
    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }

    if (user.role === "FACULTY") {
      const hasAccess = await canFacultyAccessPlot(user.id, plotId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isFacultyOrAdmin(user.role)) {
      const ownAssignment = await prisma.plotAssignment.findFirst({
        where: { plotId, studentId: user.id, status: "ACTIVE" },
      });
      if (!ownAssignment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // ADMIN/SUPER_ADMIN: no extra check

    const assignments = await prisma.plotAssignment.findMany({
      where: { plotId, status: "ACTIVE" },
      select: {
        id: true,
        studentId: true,
        facultyId: true,
        notes: true,
        assignedAt: true,
        student: {
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
        },
        faculty: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        ...a,
        assignedAt: a.assignedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[mobile/assignments GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST /api/mobile/me/plots/[id]/assignments — assign a student to a plot.
// Mirrors src/actions/assignments.ts's assignStudent exactly: the plot
// must already have an adviser (facultyId), a Faculty caller must BE that
// adviser (Admin/Super Admin may assign on any plot), and the created
// assignment's facultyId is the plot's real adviser, not the caller.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFacultyOrAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: plotId } = await params;

  try {
    const body = await req.json();
    const parsed = assignBodySchema.safeParse(body);
    if (!parsed.success) {
      const firstError = Object.values(
        parsed.error.flatten().fieldErrors
      ).flat()[0];
      return NextResponse.json(
        { error: firstError ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { studentId, notes } = parsed.data;

    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      select: { id: true, facultyId: true },
    });
    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }
    if (!plot.facultyId) {
      return NextResponse.json(
        { error: "Set a plot adviser before assigning students." },
        { status: 409 }
      );
    }
    if (user.role === "FACULTY" && plot.facultyId !== user.id) {
      return NextResponse.json(
        { error: "You are not the adviser of this plot." },
        { status: 403 }
      );
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (student.role !== "STUDENT_FARMER") {
      return NextResponse.json(
        { error: "Only student farmers can be assigned to plots" },
        { status: 400 }
      );
    }

    const existing = await prisma.plotAssignment.findFirst({
      where: { plotId, studentId, status: "ACTIVE" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Student already assigned to this plot" },
        { status: 409 }
      );
    }

    const created = await prisma.plotAssignment.create({
      data: {
        plotId,
        studentId,
        facultyId: plot.facultyId,
        notes: notes?.trim() || null,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(
      {
        assignment: {
          ...created,
          assignedAt: created.assignedAt.toISOString(),
          endedAt: created.endedAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[mobile/assignments POST] error:", error);
    return NextResponse.json(
      { error: "Failed to assign student" },
      { status: 500 }
    );
  }
}
