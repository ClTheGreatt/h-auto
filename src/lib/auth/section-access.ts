import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// True if this faculty member has an advisory row for this section.
// A null/empty section (student has none set) never matches — there's
// nothing to be "advised" for.
export async function canFacultyAdviseSection(
  facultyId: string,
  section: string | null
): Promise<boolean> {
  if (!section) return false;
  const advisory = await prisma.facultySectionAdvisory.findFirst({
    where: { facultyId, section },
  });
  return !!advisory;
}

// True if this actor may assign a student in `studentSection` to a plot.
// ADMIN/SUPER_ADMIN: unrestricted, no query. FACULTY: only within a
// section they actually advise. Anything else: denied.
//
// No case normalization here on purpose — advisory sections are stored
// uppercase (Batch 1B normalizes on write) and student sections come
// from SECTION_REGEX-validated import, so both sides are already
// uppercase. A mismatch would mean one of those wrote something
// malformed; that's a data bug to surface, not paper over here.
export async function assertFacultyCanAssignStudent(
  actorRole: UserRole,
  actorId: string,
  studentSection: string | null
): Promise<boolean> {
  if (actorRole === "SUPER_ADMIN" || actorRole === "ADMIN") return true;
  if (actorRole === "FACULTY") {
    return canFacultyAdviseSection(actorId, studentSection);
  }
  return false;
}
