import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";
import { BASE_ASSIGNABLE_STUDENT_WHERE } from "@/lib/students/eligibility";

export type AssignableStudentsActor = { role: UserRole; userId: string };
export type AssignableStudentCohort = { course: string | null; section: string };

/**
 * The WHERE clause for "students eligible to be assigned to a plot this
 * actor manages" — shared by the web plot detail page and the mobile
 * assignable-students endpoint so the two can't drift.
 *
 * ADMIN/SUPER_ADMIN: unscoped. FACULTY: scoped to their advised sections —
 * the `section: { in: advisedSections } }` filter is applied unconditionally,
 * never skipped for an empty array, so zero advisories means zero eligible
 * students rather than silently falling back to an unscoped list. Any other
 * role: no assignable students (callers are expected to gate before calling,
 * same as the web page's existing ternary; this is a defensive default, not
 * a behavior change for either current caller).
 *
 * Already-assigned-to-this-plot exclusion is deliberately NOT part of this
 * filter — both the web dialog and the mobile picker exclude those
 * client-side from the full candidate list.
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

  const advisedSections =
    actor.role === "FACULTY"
      ? (
          await prisma.facultySectionAdvisory.findMany({
            where: { facultyId: actor.userId },
            select: { section: true },
          })
        ).map((a) => a.section)
      : [];

  return {
    ...BASE_ASSIGNABLE_STUDENT_WHERE,
    ...(actor.role === "FACULTY" ? { section: { in: advisedSections } } : {}),
  };
}

// One actor-scoped cohort source for every web assignment picker. Keeping
// this beside the canonical eligibility predicate prevents Plot Detail and
// the Assignments page from independently widening course/section options.
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
