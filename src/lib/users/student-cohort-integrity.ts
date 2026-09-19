import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { normalizeAcademicSection } from "@/lib/academics/cohort-integrity";
import { shouldCompleteAssignmentsForStudentTransition } from "@/lib/users/student-assignment-lifecycle";

export const ACTIVE_ASSIGNMENT_STUDENT_COHORT_ERROR =
  "This student's course or section cannot be changed while they have an active plot assignment. Complete the active assignment first.";

export type StudentCohortIntegrityClient = Pick<
  Prisma.TransactionClient,
  "plotAssignment"
>;

type StudentCohortState = {
  id: string;
  role: UserRole;
  status: UserStatus;
  course: string | null;
  section: string | null;
};

type StudentCohortResult =
  | { ok: true }
  | { ok: false; error: string };

export function canonicalStudentCourse(
  value: string | null | undefined
): string | null {
  return value?.trim() || null;
}

export function canonicalStudentSection(
  value: string | null | undefined
): string | null {
  return value ? normalizeAcademicSection(value) || null : null;
}

export function canonicalStudentCohortValues(input: {
  course?: string | null;
  section?: string | null;
}): Pick<StudentCohortState, "course" | "section"> {
  return {
    course: canonicalStudentCourse(input.course),
    section: canonicalStudentSection(input.section),
  };
}

export async function validateStudentCohortMutation(
  current: StudentCohortState,
  next: Pick<
    StudentCohortState,
    "role" | "status" | "course" | "section"
  >,
  client: StudentCohortIntegrityClient
): Promise<StudentCohortResult> {
  if (current.role !== "STUDENT_FARMER") return { ok: true };

  // Eligibility loss completes ACTIVE assignments in the same surrounding
  // transaction. It takes precedence so deactivation and role exit remain a
  // single safe operation even when the form also submits cohort changes.
  if (
    shouldCompleteAssignmentsForStudentTransition(current, {
      role: next.role,
      status: next.status,
    })
  ) {
    return { ok: true };
  }

  const currentCohort = canonicalStudentCohortValues(current);
  const nextCohort = canonicalStudentCohortValues(next);
  const courseChanged = currentCohort.course !== nextCohort.course;
  const sectionChanged = currentCohort.section !== nextCohort.section;
  if (!courseChanged && !sectionChanged) return { ok: true };

  const activeAssignment = await client.plotAssignment.findFirst({
    where: { studentId: current.id, status: "ACTIVE" },
    select: { id: true },
  });

  return activeAssignment
    ? { ok: false, error: ACTIVE_ASSIGNMENT_STUDENT_COHORT_ERROR }
    : { ok: true };
}

export async function applyUserUpdateWithStudentCohortIntegrity<T>(
  input: {
    current: StudentCohortState;
    next: Pick<
      StudentCohortState,
      "role" | "status" | "course" | "section"
    >;
  },
  client: StudentCohortIntegrityClient,
  updateUser: () => Promise<T>
): Promise<{ ok: false; error: string } | { ok: true; value: T }> {
  const validation = await validateStudentCohortMutation(
    input.current,
    input.next,
    client
  );
  if (!validation.ok) return validation;

  return { ok: true, value: await updateUser() };
}
