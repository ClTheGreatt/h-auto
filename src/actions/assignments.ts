"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";
import { assertFacultyCanAssignStudent } from "@/lib/auth/section-access";
import { buildAssignableStudentsWhere } from "@/lib/students/assignable-students";
import { isActivityPlotStatus } from "@/lib/plots/lifecycle";
import { assignmentRequestError } from "@/lib/assignments/assignment-filters";
import { mayBeActivePairUniqueConflict } from "@/lib/assignments/active-pair-conflict";
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

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    select: { facultyId: true, status: true },
  });
  if (!plot) return { error: "Plot not found" };
  if (!isActivityPlotStatus(plot.status)) {
    return {
      error: "Students can only be assigned while a plot is preparing or operational.",
    };
  }

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
  const [canAssign, existing] = await Promise.all([
    // The picker's section filter is UI convenience only. A missing or
    // sectionless student remains denied for Faculty; admins retain their
    // existing broader section scope.
    assertFacultyCanAssignStudent(
      session.user.role,
      session.user.id,
      student?.section ?? null
    ),
    prisma.plotAssignment.findFirst({
      where: { plotId, studentId, status: "ACTIVE" },
    }),
  ]);
  const requestError = assignmentRequestError({
    student,
    sectionAuthorized: canAssign,
    hasActiveAssignment: Boolean(existing),
  });
  if (requestError) {
    return { error: requestError };
  }

  try {
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
  } catch (error) {
    if (mayBeActivePairUniqueConflict(error)) {
      const activePair = await prisma.plotAssignment.findFirst({
        where: { plotId, studentId, status: "ACTIVE" },
        select: { id: true },
      });
      if (activePair) return { error: "This student is already assigned to this plot" };
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
        idNumber: string | null;
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
      where: { plotId, status: "ACTIVE" },
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
  client: Pick<typeof prisma, "plot" | "facultySectionAdvisory" | "user">
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

  // No section-count or cohort query happens until this authority check.
  const sectionAuthorized =
    actor.role !== "FACULTY" ||
    Boolean(
      await client.facultySectionAdvisory.findFirst({
        where: { facultyId: actor.id, section: target.section },
        select: { id: true },
      })
    );
  const accessError = sectionAssignmentAccessError({
    role: actor.role,
    actorId: actor.id,
    plotFacultyId: plot.facultyId,
    plotStatus: plot.status,
    sectionAuthorized,
  });
  if (accessError) return { error: accessError } as const;

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

async function withSerializableRetries<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" || attempt === 2
      ) {
        throw error;
      }
    }
  }
  throw new Error("Assignment transaction retry limit reached.");
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

  const result = await withSerializableRetries(() => prisma.$transaction(async (tx) => {
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
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 15000,
  }));

  if ("error" in result) return result;
  revalidatePath(`/dashboard/plots/${target.plotId}`);
  revalidatePath("/dashboard/assignments");
  return result;
}
