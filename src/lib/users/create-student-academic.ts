import {
  SECTION_REGEX,
  deriveAcademicYearFromIdPrefix,
  expectedYearLevelForEntryAcademicYear,
  isSectionAllowedForCourse,
  isValidStudentIdPrefix,
} from "@/lib/constants/user-import";

export type CreateStudentAcademicState = {
  idNumber: string;
  academicYear: string;
  yearLevel: string;
  section: string;
  course: string;
  previousAutoDerivedAcademicYear: string | null;
};

export type CreateStudentAcademicResult = {
  academicYear: string;
  yearLevel: string;
  section: string;
  autoDerivedAcademicYear: string | null;
};

function sectionMatchesYear(section: string, yearLevel: string): boolean {
  const match = SECTION_REGEX.exec(section.trim());
  return !!match && Number(match[2]) === Number.parseInt(yearLevel, 10);
}

/**
 * Keeps only the fields that are safe to retain after a create-form Student
 * ID change. The caller owns provenance: a non-null previous auto-derived
 * value means the academic year may still be replaced automatically.
 */
export function synchronizeCreateStudentAcademicState(
  state: CreateStudentAcademicState
): CreateStudentAcademicResult {
  const idNumber = state.idNumber.trim();
  const academicYearFromId = deriveAcademicYearFromIdPrefix(idNumber);
  const derivedAcademicYear =
    academicYearFromId && isValidStudentIdPrefix(idNumber)
      ? academicYearFromId
      : null;

  if (!derivedAcademicYear) {
    const wasAutoManaged = state.previousAutoDerivedAcademicYear !== null;
    return {
      academicYear:
        wasAutoManaged &&
        state.academicYear.trim() === state.previousAutoDerivedAcademicYear
          ? ""
          : state.academicYear,
      yearLevel: wasAutoManaged ? "" : state.yearLevel,
      section: wasAutoManaged ? "" : state.section,
      autoDerivedAcademicYear: null,
    };
  }

  const mayReplaceAcademicYear =
    !state.academicYear.trim() ||
    (state.previousAutoDerivedAcademicYear !== null &&
      state.academicYear.trim() === state.previousAutoDerivedAcademicYear);
  const expectedYearLevel =
    expectedYearLevelForEntryAcademicYear(derivedAcademicYear) ?? "";
  const section = state.section.trim();
  const sectionMatchesCourse =
    !state.course.trim() || isSectionAllowedForCourse(state.course, section);

  return {
    academicYear: mayReplaceAcademicYear
      ? derivedAcademicYear
      : state.academicYear,
    yearLevel: expectedYearLevel,
    section:
      section &&
      expectedYearLevel &&
      sectionMatchesYear(section, expectedYearLevel) &&
      sectionMatchesCourse
        ? state.section
        : "",
    autoDerivedAcademicYear: mayReplaceAcademicYear
      ? derivedAcademicYear
      : null,
  };
}

export function sectionAfterCreateStudentCourseChange(
  course: string,
  section: string
): string {
  if (!section.trim()) return section;
  return isSectionAllowedForCourse(course, section) ? section : "";
}
