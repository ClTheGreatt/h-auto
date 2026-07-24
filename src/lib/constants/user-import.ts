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

// Assumes the format regex (STUDENT_ID_REGEX) already passed — this only
// checks the numeric prefix range, so callers can report a distinct
// "wrong format" vs "wrong prefix" message.
export function isValidStudentIdPrefix(idNumber: string): boolean {
  const prefix = parseInt(idNumber.slice(0, 2), 10);
  const { min, max } = studentIdPrefixRange();
  return prefix >= min && prefix <= max;
}

// Which columns are required, per import type. Single source of truth for:
// the template's header asterisk/fill, the Instructions sheet's "Required
// fields" note, and the preview table's header asterisk.
export const FACULTY_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "idNumber",
  "department",
  "position",
  "password",
] as const;

export const STUDENT_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "idNumber",
  "course",
  "section",
  "password",
] as const;

// Case-insensitive prefix/substring match against a fixed list of valid
// values, for a friendly "did you mean X?" suggestion on enum mismatches.
// Falls back to a truncated preview of valid values (with a count) when
// nothing is close enough to guess.
export function enumMismatchMessage(
  value: string,
  validValues: readonly string[],
  fieldName: string,
  unitLabel: string = "valid values"
): string {
  const lower = value.trim().toLowerCase();
  const suggestion = validValues.find(
    (v) => v.toLowerCase().startsWith(lower) || v.toLowerCase().includes(lower)
  );
  if (suggestion) {
    return `${fieldName} "${value}" is not valid — did you mean "${suggestion}"?`;
  }
  const preview = validValues.slice(0, 3).join(", ");
  return `${fieldName} must be one of: ${preview}, ... (${validValues.length} ${unitLabel})`;
}

// Full column list per import type, in template/upload order. Single source
// of truth for: the template generator's Data-sheet columns, and row
// normalization before validation (so a column that's entirely absent from
// the uploaded file — not just blank — still reaches the schema as "",
// never `undefined`).
export const FACULTY_IMPORT_COLUMNS = [
  "firstName",
  "middleName",
  "lastName",
  "email",
  "phoneNumber",
  "idNumber",
  "department",
  "position",
  "password",
] as const;

export const STUDENT_IMPORT_COLUMNS = [
  "firstName",
  "middleName",
  "lastName",
  "email",
  "phoneNumber",
  "idNumber",
  "course",
  "yearLevel",
  "section",
  "password",
] as const;

// Columns that only ever appear on ONE side — used to detect "wrong
// template uploaded" from header shape alone, when no machine-readable
// marker is available (plain CSV, or a hand-built file).
export const FACULTY_DISTINCTIVE_FIELDS = ["department", "position"] as const;
export const STUDENT_DISTINCTIVE_FIELDS = ["course", "section"] as const;

export type ImportRowType = "FACULTY" | "STUDENT_FARMER";

// Machine-readable marker written into each generated template's hidden
// "Lists" sheet (see template-generator.ts), read back on parse to catch a
// mismatched upload before any per-row validation runs.
export const IMPORT_TYPE_MARKER: Record<ImportRowType, string> = {
  FACULTY: "H-AUTO-IMPORT-TYPE:FACULTY",
  STUDENT_FARMER: "H-AUTO-IMPORT-TYPE:STUDENT_FARMER",
};

export function parseImportTypeMarker(value: unknown): ImportRowType | null {
  if (value === IMPORT_TYPE_MARKER.FACULTY) return "FACULTY";
  if (value === IMPORT_TYPE_MARKER.STUDENT_FARMER) return "STUDENT_FARMER";
  return null;
}

// Fallback for files with no marker: infer the actual type from which
// distinctive columns are present. Returns the detected type only when it
// disagrees with `selectedType` — null means "no mismatch detected" (either
// it matches, or the shape is ambiguous, in which case per-row validation
// is left to report specifics).
export function detectImportTypeMismatch(
  headers: readonly string[],
  selectedType: ImportRowType
): ImportRowType | null {
  const headerSet = new Set(headers.map((h) => h.replace(/\s*\*$/, "").trim()));
  const hasFacultyFields = FACULTY_DISTINCTIVE_FIELDS.some((f) => headerSet.has(f));
  const hasStudentFields = STUDENT_DISTINCTIVE_FIELDS.some((f) => headerSet.has(f));

  if (selectedType === "FACULTY" && hasStudentFields && !hasFacultyFields) {
    return "STUDENT_FARMER";
  }
  if (selectedType === "STUDENT_FARMER" && hasFacultyFields && !hasStudentFields) {
    return "FACULTY";
  }
  return null;
}

const IMPORT_TYPE_STEP1_LABEL: Record<ImportRowType, string> = {
  FACULTY: "Faculty members",
  STUDENT_FARMER: "Student farmers",
};

const IMPORT_TYPE_TEMPLATE_LABEL: Record<ImportRowType, string> = {
  FACULTY: "Faculty",
  STUDENT_FARMER: "Student Farmer",
};

export function importTypeMismatchMessage(
  selectedType: ImportRowType,
  detectedType: ImportRowType
): string {
  return (
    `This is a ${IMPORT_TYPE_TEMPLATE_LABEL[detectedType]} template, but ` +
    `"${IMPORT_TYPE_STEP1_LABEL[selectedType]}" is selected in Step 1. ` +
    `Switch the import type or upload the matching template.`
  );
}
