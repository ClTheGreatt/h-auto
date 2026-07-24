// Single source of truth for CSV/Excel user-import validation. Imported by
// the Zod schemas (src/lib/validations/import.ts), the Excel template
// generator (src/lib/imports/template-generator.ts), and nowhere else —
// the preview UI just renders whatever errors the schemas produce.

// Shared by faculty `department` and student `course` — same 5 canonical
// program/department names for both roles.
export const DEPARTMENTS = [
  "BS Agriculture - Animal Science",
  "BS Agriculture - Crop Science",
  "BTVTEd - Animal Production",
  "BTVTEd - Crops Production",
  "BS Agricultural and Biosystems Engineering",
] as const;

export const FACULTY_POSITIONS = [
  "Instructor I",
  "Instructor II",
  "Instructor III",
  "Assistant Professor I",
  "Assistant Professor II",
  "Assistant Professor III",
  "Assistant Professor IV",
  "Associate Professor I",
  "Associate Professor II",
  "Associate Professor III",
  "Associate Professor IV",
  "Associate Professor V",
  "Professor I",
  "Professor II",
  "Professor III",
  "Professor IV",
  "Professor V",
  "Professor VI",
] as const;

// Faculty employee ID: 6 digits, dash, 4 digits (e.g. 202000-0001).
export const FACULTY_ID_REGEX = /^\d{6}-\d{4}$/;

// Student ID: 2-digit year prefix, dash, 5 digits (e.g. 23-04567). The
// prefix's valid range is checked separately (see studentIdPrefixRange)
// since it depends on the current year.
export const STUDENT_ID_REGEX = /^\d{2}-\d{5}$/;

// Section: one of the 3 program prefixes, dash, year digit 1-4, one
// uppercase letter (e.g. BSA-1A, BTVTED-2B, BSABE-3C). Shape and
// prefix-membership only — NOT cross-validated against the selected course.
export const SECTION_REGEX = /^(BSA|BTVTED|BSABE)-[1-4][A-Z]$/;

// Import-only phone rule: stricter than the interactive Add User form
// (src/lib/validations/user.ts's phPhone), which also accepts 09XXXXXXXXX.
export const IMPORT_PHONE_REGEX = /^\+639\d{9}$/;

// Student ID prefix must be between 20 and (current year % 100) + 1 —
// e.g. in 2026 that's 20 through 27 inclusive.
export function studentIdPrefixRange(): { min: number; max: number } {
  return { min: 20, max: (new Date().getFullYear() % 100) + 1 };
}
