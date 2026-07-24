import {
  facultyImportRowSchema,
  studentImportRowSchema,
  type ImportRowType,
} from "@/lib/validations/import";

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
};

// Shared by both the CSV and Excel parse paths: validates raw row objects
// against the schema for the selected import type and flags duplicate emails.
export function buildParsedRows(
  data: Record<string, string>[],
  importType: ImportRowType
): ParsedRow[] {
  const schema =
    importType === "FACULTY" ? facultyImportRowSchema : studentImportRowSchema;

  const emailCounts = new Map<string, number>();
  const idNumberCounts = new Map<string, number>();
  data.forEach((row) => {
    const email = row.email?.trim().toLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);

    const idNumber = row.idNumber?.trim();
    if (idNumber) idNumberCounts.set(idNumber, (idNumberCounts.get(idNumber) ?? 0) + 1);
  });

  return data.map((raw, idx) => {
    const trimmed: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      trimmed[k] = typeof v === "string" ? v.trim() : String(v ?? "");
    }

    const result = schema.safeParse(trimmed);
    const errors: string[] = [];

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path.join(".") || "row";
        // Most import messages already self-name their field (e.g. "idNumber
        // is required") — only prefix the ones that don't (shared validators
        // like bpsuEmail/passwordStrengthSchema), to avoid "email: Email is
        // required"-style duplication.
        errors.push(
          issue.message.toLowerCase().startsWith(field.toLowerCase())
            ? issue.message
            : `${field}: ${issue.message}`
        );
      }
    }

    const email = trimmed.email?.toLowerCase();
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
