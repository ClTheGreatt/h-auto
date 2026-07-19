"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";

export async function assignStudent(
  plotId: string,
  studentId: string,
  notes?: string
) {
  const session = await requireFaculty();

  // FACULTY is scoped to plots they actively advise; ADMIN/SUPER_ADMIN keep
  // unrestricted access.
  if (session.user.role === "FACULTY") {
    const hasAccess = await canFacultyAccessPlot(session.user.id, plotId);
    if (!hasAccess) return { error: "You don't have access to this plot" };
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT_FARMER") {
    return { error: "Selected user is not a student farmer" };
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
      facultyId: session.user.id,
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
