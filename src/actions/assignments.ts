"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";
import { isActivityPlotStatus } from "@/lib/plots/lifecycle";
import { mayBeActivePairUniqueConflict } from "@/lib/assignments/active-pair-conflict";
import {
  runAssignmentTransaction,
  TARGET_ADVISER_COHORT_ERROR,
  validateAssignmentCohortAuthorities,
  validateFinalAssignment,
} from "@/lib/assignments/assignment-integrity";
import {
  buildSectionStudentsWhere,
  classifySectionStudents,
  finalSectionAssignmentCounts,
  sectionAssignmentAccessError,
  sectionAssignmentInputError,
  sectionAssignmentRows,
  type SectionAssignmentTarget,
} from "@/lib/assignments/section-assignment";

export async function assignStudent(
  plotId: string,
  studentId: string,
  notes?: string
) {
  const session = await requireFaculty();

  try {
    const result = await runAssignmentTransaction(async (tx) => {
      const validation = await validateFinalAssignment(
        {
          actor: { role: session.user.role, id: session.user.id },
          plotId,
          studentId,
        },
        tx
      );
      if (!validation.ok) return validation;

      await tx.plotAssignment.create({
        data: {
          plotId,
          studentId,
          facultyId: validation.plot.facultyId,
          assignedById: session.user.id,
          notes: notes || null,
          status: "ACTIVE",
        },
      });
      return { ok: true as const };
    });

    if (!result.ok) return { error: result.error };
  } catch (error) {
    if (mayBeActivePairUniqueConflict(error)) {
      const activePair = await prisma.plotAssignment.findFirst({
        where: { plotId, studentId, status: "ACTIVE" },
        select: { id: true },
      });
      if (activePair) {
        return { error: "This student is already assigned to this plot." };
      }
    }
    throw error;
  }

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

// Assignable students for a plot/course/section chosen dynamically on the
// cross-plot Assignments page. The explicit cohort target keeps same-named
// sections in different courses separate.
export async function getAssignableStudentsForPlot(
  target: SectionAssignmentTarget
): Promise<
  | { error: string }
  | {
      students: {
        id: string;
        firstName: string;
        lastName: string;
        idNumber: string | null;
        email: string;
        course: string | null;
        yearLevel: string | null;
        section: string | null;
      }[];
    }
> {
  const session = await requireFaculty();
  if (!target) return { error: "Select a plot, course, and section." };
  const inputError = sectionAssignmentInputError(target);
  if (inputError) return { error: inputError };

  const plot = await prisma.plot.findUnique({
    where: { id: target.plotId },
    select: { facultyId: true, status: true },
  });
  if (!plot) return { error: "Plot not found" };
  if (!isActivityPlotStatus(plot.status)) {
    return {
      error: "Students can only be assigned while a plot is preparing or operational.",
    };
  }

  // Mirrors canManageAssignments in the mobile assignable-students route
  // (src/app/api/mobile/me/plots/[id]/assignable-students/route.ts),
  // reimplemented inline rather than via assertCanAccessPlot — that helper
  // also grants a STUDENT_FARMER view access to a plot they're actively
  // assigned to, which this action must never do. requireFaculty() above
  // already rejects STUDENT_FARMER outright; this only decides between
  // ADMIN/SUPER_ADMIN (unrestricted) and FACULTY (their own plot only).
  const baseAccessError = sectionAssignmentAccessError({
    role: session.user.role,
    actorId: session.user.id,
    plotFacultyId: plot.facultyId,
    plotStatus: plot.status,
    sectionAuthorized: true,
  });
  if (baseAccessError) return { error: baseAccessError };

  const cohortAuthority = await validateAssignmentCohortAuthorities({
    actor: { role: session.user.role, id: session.user.id },
    plotFacultyId: plot.facultyId!,
    course: target.course,
    section: target.section,
  });
  if (!cohortAuthority.actorAuthorized) {
    return {
      error:
        "You are not authorized to assign a student from this course and section.",
    };
  }
  if (!cohortAuthority.targetAdviserAuthorized) {
    return { error: TARGET_ADVISER_COHORT_ERROR };
  }

  const [students, activeOnThisPlot] = await Promise.all([
    prisma.user.findMany({
      where: buildSectionStudentsWhere(target),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        idNumber: true,
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
      where: { plotId: target.plotId, status: "ACTIVE" },
      select: { studentId: true },
    }),
  ]);

  const assignedIds = new Set(activeOnThisPlot.map((a) => a.studentId));
  return { students: students.filter((s) => !assignedIds.has(s.id)) };
}

// The preview and submit deliberately share the same authorization gate.
// The client supplies a cohort target, never an authoritative student list.
async function validateSectionTarget(
  target: SectionAssignmentTarget,
  actor: { role: UserRole; id: string },
  client: Pick<typeof prisma, "plot" | "user">
) {
  const inputError = sectionAssignmentInputError(target);
  if (inputError) return { error: inputError } as const;

  const plot = await client.plot.findUnique({
    where: { id: target.plotId },
    select: { facultyId: true, status: true, name: true },
  });
  if (!plot) return { error: "Plot not found" } as const;

  const plotAccessError = sectionAssignmentAccessError({
    role: actor.role,
    actorId: actor.id,
    plotFacultyId: plot.facultyId,
    plotStatus: plot.status,
    sectionAuthorized: true,
  });
  if (plotAccessError) return { error: plotAccessError } as const;

  // Actor permission and target adviser integrity are separate. Admin roles
  // may perform assignments, but the plot adviser must still own this exact
  // current cohort.
  const cohortAuthority = await validateAssignmentCohortAuthorities(
    {
      actor,
      plotFacultyId: plot.facultyId!,
      course: target.course,
      section: target.section,
    },
    client
  );
  const accessError = sectionAssignmentAccessError({
    role: actor.role,
    actorId: actor.id,
    plotFacultyId: plot.facultyId,
    plotStatus: plot.status,
    sectionAuthorized: cohortAuthority.actorAuthorized,
  });
  if (accessError) return { error: accessError } as const;
  if (!cohortAuthority.targetAdviserAuthorized) {
    return { error: TARGET_ADVISER_COHORT_ERROR } as const;
  }

  const where = buildSectionStudentsWhere(target);
  const cohortExists = await client.user.findFirst({
    where,
    select: { id: true },
  });
  if (!cohortExists) {
    return { error: "No eligible student farmers match this course and section." } as const;
  }
  return { plot, where } as const;
}

export async function getSectionAssignmentPreview(target: SectionAssignmentTarget) {
  const session = await requireFaculty();
  if (!target) return { error: "Select a plot, course, and section." };
  const validated = await validateSectionTarget(
    target,
    { role: session.user.role, id: session.user.id },
    prisma
  );
  if ("error" in validated) return { error: validated.error };

  const students = await prisma.user.findMany({
    where: validated.where,
    select: { id: true },
  });
  const active = await prisma.plotAssignment.findMany({
    where: {
      plotId: target.plotId,
      status: "ACTIVE",
      studentId: { in: students.map((student) => student.id) },
    },
    select: { studentId: true },
  });
  return {
    counts: classifySectionStudents(
      students.map((student) => student.id),
      active.map((assignment) => assignment.studentId)
    ).counts,
  };
}

export async function assignSectionToPlot(
  target: SectionAssignmentTarget,
  notes?: string
) {
  const session = await requireFaculty();
  if (!target) return { error: "Select a plot, course, and section." };
  const actor = { role: session.user.role, id: session.user.id };

  const result = await runAssignmentTransaction(async (tx) => {
    // Reload plot/advisory/cohort inside the transaction; preview is never
    // used as authority or as the source of these counts/IDs.
    const validated = await validateSectionTarget(target, actor, tx);
    if ("error" in validated) return { error: validated.error };

    const students = await tx.user.findMany({
      where: validated.where,
      select: { id: true },
    });
    const studentIds = students.map((student) => student.id);
    const active = await tx.plotAssignment.findMany({
      where: {
        plotId: target.plotId,
        status: "ACTIVE",
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    });
    const { missingIds } = classifySectionStudents(
      studentIds,
      active.map((assignment) => assignment.studentId)
    );
    const inserted = missingIds.length
      ? await tx.plotAssignment.createMany({
          data: sectionAssignmentRows(missingIds, {
            plotId: target.plotId,
            facultyId: validated.plot.facultyId!,
            assignedById: actor.id,
            notes,
          }),
          skipDuplicates: true,
        })
      : { count: 0 };

    return {
      ...finalSectionAssignmentCounts(studentIds.length, inserted.count),
      plotName: validated.plot.name,
    };
  });

  if ("error" in result) return result;
  revalidatePath(`/dashboard/plots/${target.plotId}`);
  revalidatePath("/dashboard/assignments");
  return result;
}
