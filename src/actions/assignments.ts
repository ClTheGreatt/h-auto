"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";
import { assertFacultyCanAssignStudent } from "@/lib/auth/section-access";
import { buildAssignableStudentsWhere } from "@/lib/students/assignable-students";

export async function assignStudent(
  plotId: string,
  studentId: string,
  notes?: string
) {
  const session = await requireFaculty();

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    select: { facultyId: true },
  });
  if (!plot) return { error: "Plot not found" };

  // No adviser set yet: a PlotAssignment requires a non-null facultyId, and
  // there's no adviser to record it as. Block every caller (including
  // admins) until an adviser is assigned to the plot first.
  if (!plot.facultyId) {
    return { error: "Set a plot adviser before assigning students." };
  }

  // Faculty may only assign students on plots they actually advise;
  // ADMIN/SUPER_ADMIN keep unrestricted access.
  if (session.user.role === "FACULTY" && plot.facultyId !== session.user.id) {
    return { error: "You are not the adviser of this plot." };
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT_FARMER") {
    return { error: "Selected user is not a student farmer" };
  }
  if (student.graduatedAt) {
    return { error: "Cannot assign a graduated student to a plot." };
  }

  // The real security boundary — the picker's own section filter
  // (availableStudents in plots/[id]/page.tsx) is UI convenience only.
  const canAssign = await assertFacultyCanAssignStudent(
    session.user.role,
    session.user.id,
    student.section
  );
  if (!canAssign) {
    return {
      error: "You are not authorized to assign a student from this section.",
    };
  }

  const existing = await prisma.plotAssignment.findFirst({
    where: { plotId, studentId, status: "ACTIVE" },
  });
  if (existing) {
    return { error: "This student is already assigned to this plot" };
  }

  await prisma.plotAssignment.create({
    data: {
      plotId,
      studentId,
      facultyId: plot.facultyId,
      assignedById: session.user.id,
      notes: notes || null,
      status: "ACTIVE",
    },
  });

  revalidatePath(`/dashboard/plots/${plotId}`);
  revalidatePath("/dashboard/assignments");
  return { success: true };
}

export async function removeAssignment(assignmentId: string) {
  const session = await requireFaculty();

  const assignment = await prisma.plotAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) return { error: "Assignment not found" };

  if (session.user.role === "FACULTY") {
    const hasAccess = await canFacultyAccessPlot(session.user.id, assignment.plotId);
    if (!hasAccess) return { error: "You don't have access to this plot" };
  }

  await prisma.plotAssignment.update({
    where: { id: assignmentId },
    data: { status: "COMPLETED", endedAt: new Date() },
  });

  revalidatePath(`/dashboard/plots/${assignment.plotId}`);
  revalidatePath("/dashboard/assignments");
  return { success: true };
}

// Assignable students for a plot chosen dynamically (the cross-plot
// Assignments page) — the web analogue of GET /api/mobile/me/plots/[id]/
// assignable-students. Plot Detail can compute this inline from its own
// fixed plotId; a page where the plot is picked reactively needs it as a
// standalone call.
export async function getAssignableStudentsForPlot(
  plotId: string
): Promise<
  | { error: string }
  | {
      students: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        course: string | null;
        yearLevel: string | null;
        section: string | null;
      }[];
    }
> {
  const session = await requireFaculty();

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    select: { facultyId: true },
  });
  if (!plot) return { error: "Plot not found" };

  // Mirrors canManageAssignments in the mobile assignable-students route
  // (src/app/api/mobile/me/plots/[id]/assignable-students/route.ts),
  // reimplemented inline rather than via assertCanAccessPlot — that helper
  // also grants a STUDENT_FARMER view access to a plot they're actively
  // assigned to, which this action must never do. requireFaculty() above
  // already rejects STUDENT_FARMER outright; this only decides between
  // ADMIN/SUPER_ADMIN (unrestricted) and FACULTY (their own plot only).
  const canManageAssignments =
    session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
      ? true
      : plot.facultyId === session.user.id;
  if (!canManageAssignments) {
    return { error: "You don't have access to this plot" };
  }

  const [students, activeOnThisPlot] = await Promise.all([
    prisma.user.findMany({
      where: await buildAssignableStudentsWhere({
        role: session.user.role,
        userId: session.user.id,
      }),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        course: true,
        yearLevel: true,
        section: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    // Excluded here rather than left to the caller — matches how
    // plot-assignments.tsx filters its own already-known assignments list
    // client-side, which this page doesn't have for a freshly-picked plot.
    prisma.plotAssignment.findMany({
      where: { plotId, status: "ACTIVE" },
      select: { studentId: true },
    }),
  ]);

  const assignedIds = new Set(activeOnThisPlot.map((a) => a.studentId));
  return { students: students.filter((s) => !assignedIds.has(s.id)) };
}
