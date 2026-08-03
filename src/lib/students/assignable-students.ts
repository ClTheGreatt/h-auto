import { prisma } from "@/lib/prisma";
import type { Prisma, UserRole } from "@prisma/client";

export type AssignableStudentsActor = { role: UserRole; userId: string };

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
    role: "STUDENT_FARMER",
    status: "ACTIVE",
    graduatedAt: null,
    ...(actor.role === "FACULTY" ? { section: { in: advisedSections } } : {}),
  };
}
