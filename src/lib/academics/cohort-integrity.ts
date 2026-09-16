import { DEPARTMENTS, SECTION_REGEX } from "@/lib/constants/user-import";
import type { UserRole } from "@prisma/client";

export type AcademicProgram = (typeof DEPARTMENTS)[number];
export type AcademicCohort = { course: AcademicProgram; section: string };
export type AdvisoryIdentity = {
  id: string;
  course: string | null;
  section: string;
};

export const MISSING_FACULTY_DEPARTMENT_ERROR =
  "Set the Faculty department before assigning advised cohorts.";
export const INVALID_RESULTING_FACULTY_DEPARTMENT_ERROR =
  "Select a valid Faculty department.";
export const UNRESOLVED_ADVISORY_CONFLICT_ERROR =
  "This user has advised cohorts that still need review. Resolve or remove them before assigning a Faculty department.";
export const DEPARTMENT_ADVISORY_CONFLICT_ERROR =
  "This user has advised cohorts that do not match the selected Faculty department. Review or remove those advised cohorts first.";
export const REVIEW_SECTION_CONFLICT_ERROR =
  "Remove the existing advisory that needs review for this Section before adding the resolved cohort.";

export function isCanonicalAcademicProgram(
  value: unknown
): value is AcademicProgram {
  return (
    typeof value === "string" &&
    (DEPARTMENTS as readonly string[]).includes(value)
  );
}

export function isFacultyCourseCompatible(
  facultyDepartment: string | null | undefined,
  course: string | null | undefined
): course is AcademicProgram {
  return (
    isCanonicalAcademicProgram(facultyDepartment) &&
    isCanonicalAcademicProgram(course) &&
    facultyDepartment === course
  );
}

export function normalizeAcademicSection(section: string): string {
  return section.trim().toUpperCase();
}

export function academicCohortKey(
  cohort: { course: string; section: string }
): string {
  return JSON.stringify([cohort.course, cohort.section]);
}

export function normalizeRequestedCohorts(
  cohorts: ReadonlyArray<{ course: string; section: string }>
): Array<{ course: string; section: string }> {
  const unique = new Map<string, { course: string; section: string }>();
  for (const cohort of cohorts) {
    const normalized = {
      course: cohort.course,
      section: normalizeAcademicSection(cohort.section),
    };
    unique.set(academicCohortKey(normalized), normalized);
  }
  return [...unique.values()];
}

export function missingRequestedCohort(
  requested: ReadonlyArray<{ course: string; section: string }>,
  available: ReadonlyArray<{ course: string; section: string }>
): { course: string; section: string } | null {
  const availableKeys = new Set(available.map(academicCohortKey));
  return (
    requested.find(
      (cohort) => !availableKeys.has(academicCohortKey(cohort))
    ) ?? null
  );
}

export function requestedCohortError(
  facultyDepartment: string | null | undefined,
  cohort: { course: string; section: string }
): string | null {
  if (!isCanonicalAcademicProgram(facultyDepartment)) {
    return MISSING_FACULTY_DEPARTMENT_ERROR;
  }
  if (!isCanonicalAcademicProgram(cohort.course)) {
    return "Select a valid Course / Program.";
  }
  if (!isFacultyCourseCompatible(facultyDepartment, cohort.course)) {
    return "The selected Course / Program does not match the Faculty department.";
  }
  if (!cohort.section || !SECTION_REGEX.test(cohort.section)) {
    return "Select a valid Section.";
  }
  return null;
}

export function resultingUserAcademicState(
  existing: { role: UserRole; department: string | null },
  requested: { role?: UserRole; department?: string }
): { role: UserRole; department: string | null } {
  return {
    role: requested.role ?? existing.role,
    department:
      requested.department === undefined
        ? existing.department
        : requested.department || null,
  };
}

export function resultingFacultyAdvisoryError(
  resultingRole: UserRole,
  resultingDepartment: string | null,
  advisories: ReadonlyArray<Pick<AdvisoryIdentity, "course">>
): string | null {
  if (resultingRole !== "FACULTY") return null;
  if (!isCanonicalAcademicProgram(resultingDepartment)) {
    return INVALID_RESULTING_FACULTY_DEPARTMENT_ERROR;
  }
  if (advisories.some((advisory) => advisory.course === null)) {
    return UNRESOLVED_ADVISORY_CONFLICT_ERROR;
  }
  if (
    advisories.some(
      (advisory) =>
        !isFacultyCourseCompatible(resultingDepartment, advisory.course)
    )
  ) {
    return DEPARTMENT_ADVISORY_CONFLICT_ERROR;
  }
  return null;
}

export function isAdvisoryResolvedForDepartment(
  facultyDepartment: string | null | undefined,
  advisory: Pick<AdvisoryIdentity, "course">
): advisory is Pick<AdvisoryIdentity, "course"> & { course: AcademicProgram } {
  return isFacultyCourseCompatible(facultyDepartment, advisory.course);
}

export function resolvedAdvisoriesForDepartment(
  facultyDepartment: string | null | undefined,
  advisories: ReadonlyArray<AdvisoryIdentity>
): Array<AdvisoryIdentity & { course: AcademicProgram }> {
  return advisories.filter(
    (advisory): advisory is AdvisoryIdentity & { course: AcademicProgram } =>
      isAdvisoryResolvedForDepartment(facultyDepartment, advisory)
  );
}

export function reviewRemovalError(
  requestedIds: readonly string[],
  ownedReviewIds: readonly string[]
): string | null {
  const requested = new Set(requestedIds);
  const owned = new Set(ownedReviewIds);
  return [...requested].every((id) => owned.has(id))
    ? null
    : "One or more advisories needing review cannot be removed.";
}

export function advisorySavePlan(
  existing: ReadonlyArray<AdvisoryIdentity>,
  facultyDepartment: string | null | undefined,
  removeReviewIds: readonly string[]
):
  | { error: string }
  | {
      resolvedIdsToReplace: string[];
      reviewIdsToRemove: string[];
      reviewRowsToKeep: AdvisoryIdentity[];
    } {
  const resolvedRows = resolvedAdvisoriesForDepartment(
    facultyDepartment,
    existing
  );
  const resolvedIds = new Set(resolvedRows.map((row) => row.id));
  const reviewRows = existing.filter((row) => !resolvedIds.has(row.id));
  const removalError = reviewRemovalError(
    removeReviewIds,
    reviewRows.map((row) => row.id)
  );
  if (removalError) return { error: removalError };
  const removals = new Set(removeReviewIds);
  return {
    resolvedIdsToReplace: resolvedRows.map((row) => row.id),
    reviewIdsToRemove: [...removals],
    reviewRowsToKeep: reviewRows.filter((row) => !removals.has(row.id)),
  };
}

export function reviewSectionConflictError(
  requested: ReadonlyArray<{ section: string }>,
  reviewRowsToKeep: ReadonlyArray<Pick<AdvisoryIdentity, "section">>
): string | null {
  const retainedSections = new Set(
    reviewRowsToKeep.map((advisory) => advisory.section)
  );
  return requested.some((cohort) => retainedSections.has(cohort.section))
    ? REVIEW_SECTION_CONFLICT_ERROR
    : null;
}
