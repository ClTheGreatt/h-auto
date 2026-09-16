import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";
import { BASE_ASSIGNABLE_STUDENT_WHERE } from "@/lib/students/eligibility";
import {
  isCanonicalAcademicProgram,
  isFacultyCourseCompatible,
} from "@/lib/academics/cohort-integrity";

export type AssignableStudentsActor = { role: UserRole; userId: string };
export type AssignableStudentCohort = { course: string | null; section: string };

export function buildFacultyCohortScope(
  department: string | null,
  advisories: ReadonlyArray<{ course: string | null; section: string }>
): Prisma.UserWhereInput {
  if (!isCanonicalAcademicProgram(department)) return { id: { in: [] } };
  const resolved = advisories.filter(
    (advisory): advisory is { course: string; section: string } =>
      isFacultyCourseCompatible(department, advisory.course)
  );
  return resolved.length > 0
    ? {
        OR: resolved.map((advisory) => ({
          course: advisory.course,
          section: advisory.section,
        })),
      }
    : { id: { in: [] } };
}

/**
 * Canonical assignment eligibility shared by web and mobile. Faculty scope
 * is an OR of exact resolved course+section advisories; course=NULL legacy
 * rows grant no scope. Admin and Super Admin retain the broader base scope.
 */
export async function buildAssignableStudentsWhere(
  actor: AssignableStudentsActor
): Promise<Prisma.UserWhereInput> {
  if (
    actor.role !== "SUPER_ADMIN" &&
    actor.role !== "ADMIN" &&
    actor.role !== "FACULTY"
  ) {
    return { id: { in: [] } };
  }

  if (actor.role !== "FACULTY") return BASE_ASSIGNABLE_STUDENT_WHERE;

  const faculty = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      role: true,
      department: true,
      advisories: {
        where: { course: { not: null } },
        select: { course: true, section: true },
      },
    },
  });
  if (!faculty || faculty.role !== "FACULTY") {
    return { ...BASE_ASSIGNABLE_STUDENT_WHERE, id: { in: [] } };
  }

  return {
    ...BASE_ASSIGNABLE_STUDENT_WHERE,
    ...buildFacultyCohortScope(faculty.department, faculty.advisories),
  };
}

// One actor-scoped cohort source for the Assignments page, Plot Detail, and
// mobile candidate endpoint. Keeping this beside the canonical eligibility
// predicate prevents any caller from independently widening Faculty scope.
export async function getAssignableStudentCohorts(
  actor: AssignableStudentsActor
): Promise<AssignableStudentCohort[]> {
  const scope = await buildAssignableStudentsWhere(actor);
  const rows = await prisma.user.groupBy({
    where: { AND: [scope, { section: { not: null } }] },
    by: ["course", "section"],
  });

  return rows.filter(
    (row): row is AssignableStudentCohort => Boolean(row.section)
  );
}
