import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mayBeActivePairUniqueConflict } from "@/lib/assignments/active-pair-conflict";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";
import {
  runAssignmentTransaction,
  type AssignmentIntegrityErrorCode,
  validateFinalAssignment,
} from "@/lib/assignments/assignment-integrity";

const assignBodySchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  notes: z.string().max(500).optional(),
});

function isFacultyOrAdmin(role: string) {
  return role === "FACULTY" || role === "ADMIN" || role === "SUPER_ADMIN";
}

function assignmentIntegrityStatus(code: AssignmentIntegrityErrorCode): number {
  switch (code) {
    case "PLOT_NOT_FOUND":
    case "STUDENT_NOT_FOUND":
      return 404;
    case "ACTOR_FORBIDDEN":
    case "ACTOR_NOT_PLOT_ADVISER":
    case "ACTOR_COHORT_FORBIDDEN":
      return 403;
    case "PLOT_INELIGIBLE":
    case "PLOT_ADVISER_REQUIRED":
    case "DUPLICATE_ACTIVE_ASSIGNMENT":
      return 409;
    default:
      return 400;
  }
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

    let created;
    try {
      const result = await runAssignmentTransaction(async (tx) => {
        const validation = await validateFinalAssignment(
          {
            actor: { role: user.role, id: user.id },
            plotId,
            studentId,
          },
          tx
        );
        if (!validation.ok) return validation;

        const assignment = await tx.plotAssignment.create({
          data: {
            plotId,
            studentId,
            facultyId: validation.plot.facultyId,
            assignedById: user.id,
            notes: notes?.trim() || null,
            status: "ACTIVE",
          },
        });
        return { ok: true as const, assignment };
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: assignmentIntegrityStatus(result.code) }
        );
      }
      created = result.assignment;
    } catch (error) {
      if (mayBeActivePairUniqueConflict(error)) {
        const activePair = await prisma.plotAssignment.findFirst({
          where: { plotId, studentId, status: "ACTIVE" },
          select: { id: true },
        });
        if (activePair) {
          return NextResponse.json(
            { error: "This student is already assigned to this plot." },
            { status: 409 }
          );
        }
      }
      throw error;
    }

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
