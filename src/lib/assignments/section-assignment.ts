import type { PlotStatus, Prisma, UserRole } from "@prisma/client";
import { isActivityPlotStatus } from "@/lib/plots/lifecycle";
import { BASE_ASSIGNABLE_STUDENT_WHERE } from "@/lib/students/eligibility";

export type SectionAssignmentTarget = {
  plotId: string;
  course: string | null;
  section: string;
};

export type SectionAssignmentCounts = {
  eligibleStudents: number;
  alreadyAssigned: number;
  willBeAssigned: number;
};

export const COURSE_NOT_RECORDED = "Course not recorded";

export function sectionAssignmentAccessError({
  role,
  actorId,
  plotFacultyId,
  plotStatus,
  sectionAuthorized,
}: {
  role: UserRole;
  actorId: string;
  plotFacultyId: string | null;
  plotStatus: PlotStatus;
  sectionAuthorized: boolean;
}): string | null {
  if (role !== "FACULTY" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return "You are not authorized to assign students.";
  }
  if (!plotFacultyId) return "Set a plot adviser before assigning students.";
  if (role === "FACULTY" && plotFacultyId !== actorId) {
    return "You are not the adviser of this plot.";
  }
  if (!isActivityPlotStatus(plotStatus)) {
    return "Students can only be assigned while a plot is preparing or operational.";
  }
  if (!sectionAuthorized) {
    return "You are not authorized to assign students from this course and section.";
  }
  return null;
}

export function sectionAssignmentInputError(target: SectionAssignmentTarget): string | null {
  if (!target.plotId || !target.section?.trim()) {
    return "Select a plot, course, and section.";
  }
  if (target.course !== null && (typeof target.course !== "string" || !target.course.trim())) {
    return "Select a valid course.";
  }
  return null;
}

// Keep these predicates aligned with buildAssignableStudentsWhere's canonical
// role/status/graduation eligibility. Course is cohort narrowing, never auth.
export function buildSectionStudentsWhere(
  target: SectionAssignmentTarget
): Prisma.UserWhereInput {
  return {
    ...BASE_ASSIGNABLE_STUDENT_WHERE,
    section: target.section,
    course: target.course,
  };
}

export function classifySectionStudents(
  studentIds: string[],
  activeStudentIds: Iterable<string>
): { counts: SectionAssignmentCounts; missingIds: string[] } {
  const assigned = new Set(activeStudentIds);
  const missingIds = studentIds.filter((id) => !assigned.has(id));
  return {
    counts: {
      eligibleStudents: studentIds.length,
      alreadyAssigned: studentIds.length - missingIds.length,
      willBeAssigned: missingIds.length,
    },
    missingIds,
  };
}

export function finalSectionAssignmentCounts(
  eligibleStudents: number,
  created: number
): { eligibleStudents: number; created: number; alreadyAssigned: number } {
  return { eligibleStudents, created, alreadyAssigned: eligibleStudents - created };
}

export function sectionAssignmentRows(
  missingIds: string[],
  fields: { plotId: string; facultyId: string; assignedById: string; notes?: string }
) {
  return missingIds.map((studentId) => ({
    plotId: fields.plotId,
    studentId,
    facultyId: fields.facultyId,
    assignedById: fields.assignedById,
    status: "ACTIVE" as const,
    notes: fields.notes || null,
  }));
}
