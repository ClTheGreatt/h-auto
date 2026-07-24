import type { ZodError } from "zod";
import { facultyImportRowSchema, studentImportRowSchema } from "@/lib/validations/import";
import {
  FACULTY_IMPORT_COLUMNS,
  STUDENT_IMPORT_COLUMNS,
  deriveAcademicYearFromIdPrefix,
  type ImportRowType,
} from "@/lib/constants/user-import";

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
};

// Normalizes a raw parsed row (from either CSV or Excel) to exactly the
// columns the selected import type expects, as strings. This is what keeps
// a column that's entirely ABSENT from the file (e.g. the wrong template
// was uploaded) from reaching the schema as `undefined` — Zod's own
// "expected string, received undefined" default would otherwise bypass
// every custom "X is required" message on that field.
export function normalizeImportRow(
  raw: Record<string, unknown>,
  importType: ImportRowType
): Record<string, string> {
  const columns = importType === "FACULTY" ? FACULTY_IMPORT_COLUMNS : STUDENT_IMPORT_COLUMNS;
  const normalized: Record<string, string> = {};
  for (const col of columns) {
    const value = raw[col];
    normalized[col] = typeof value === "string" ? value.trim() : value == null ? "" : String(value);
  }

  // Student academicYear: if blank, derive from the idNumber prefix so the
  // preview already shows what will actually be saved. A present value
  // (however typed) is always used as given, never overwritten.
  if (importType === "STUDENT_FARMER" && !normalized.academicYear) {
    normalized.academicYear = deriveAcademicYearFromIdPrefix(normalized.idNumber) ?? "";
  }

  return normalized;
}

// Turns a Zod issue into a display-ready message. Every field in the import
// schemas carries an explicit custom message, so "invalid_type" (Zod's
// generic "expected X, received Y") should never fire in practice — this is
// the safety net in case some path still reaches the schema with a raw
// `undefined`/wrong-typed value.
export function formatZodIssue(issue: ZodError["issues"][number]): string {
  const field = issue.path.join(".") || "row";
  if (issue.code === "invalid_type") {
    return `${field} is invalid`;
  }
  // Most import messages already self-name their field (e.g. "idNumber is
  // required") — only prefix the ones that don't (shared validators like
  // bpsuEmail/passwordStrengthSchema), to avoid "email: Email is
  // required"-style duplication.
  return issue.message.toLowerCase().startsWith(field.toLowerCase())
    ? issue.message
    : `${field}: ${issue.message}`;
}

// Shared by both the CSV and Excel parse paths: validates raw row objects
// against the schema for the selected import type and flags duplicate emails.
// Callers are expected to have already ruled out a wrong-template upload
// (see detectImportTypeMismatch) — this only validates row content.
export function buildParsedRows(
  data: Record<string, string>[],
  importType: ImportRowType
): ParsedRow[] {
  const schema =
    importType === "FACULTY" ? facultyImportRowSchema : studentImportRowSchema;

  const normalizedRows = data.map((raw) => normalizeImportRow(raw, importType));

  const emailCounts = new Map<string, number>();
  const idNumberCounts = new Map<string, number>();
  normalizedRows.forEach((row) => {
    const email = row.email.toLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);

    const idNumber = row.idNumber;
    if (idNumber) idNumberCounts.set(idNumber, (idNumberCounts.get(idNumber) ?? 0) + 1);
  });

  return normalizedRows.map((trimmed, idx) => {
    const result = schema.safeParse(trimmed);
    const errors: string[] = result.success ? [] : result.error.issues.map(formatZodIssue);

    const email = trimmed.email.toLowerCase();
    if (email && (emailCounts.get(email) ?? 0) > 1) {
      errors.push("Duplicate email within this file");
    }

    const idNumber = trimmed.idNumber;
    if (idNumber && (idNumberCounts.get(idNumber) ?? 0) > 1) {
      errors.push("Duplicate ID number within this file");
    }

    return {
      rowNumber: idx + 2, // +2 because header is row 1 and rows are 1-indexed
      raw: trimmed,
      errors,
    };
  });
}
