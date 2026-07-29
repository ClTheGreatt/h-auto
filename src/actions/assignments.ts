"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";
import { assertFacultyCanAssignStudent } from "@/lib/auth/section-access";

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
