import { prisma } from "@/lib/prisma";
import { isCanonicalAcademicProgram } from "@/lib/academics/cohort-integrity";
import type { UserRole } from "@prisma/client";

type CohortAccessClient = Pick<typeof prisma, "user">;

// Faculty authority is an exact, resolved academic cohort. Requiring both
// the Faculty department and advisory course to equal the requested course
// prevents legacy course=NULL rows and incompatible rows from granting scope.
export async function canFacultyAdviseCohort(
  facultyId: string,
  course: string | null,
  section: string | null,
  client: CohortAccessClient = prisma
): Promise<boolean> {
  if (!isCanonicalAcademicProgram(course) || !section) return false;
  const faculty = await client.user.findFirst({
    where: {
      id: facultyId,
      role: "FACULTY",
      department: course,
      advisories: { some: { course, section } },
    },
    select: { id: true },
  });
  return Boolean(faculty);
}

export async function assertFacultyCanAssignStudent(
  actorRole: UserRole,
  actorId: string,
  studentCourse: string | null,
  studentSection: string | null,
  client: CohortAccessClient = prisma
): Promise<boolean> {
  if (actorRole === "SUPER_ADMIN" || actorRole === "ADMIN") return true;
  if (actorRole === "FACULTY") {
    return canFacultyAdviseCohort(
      actorId,
      studentCourse,
      studentSection,
      client
    );
  }
  return false;
}
