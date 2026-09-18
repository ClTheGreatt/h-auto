import { z } from "zod";
import { bpsuEmail } from "./email";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  FACULTY_ID_REGEX,
  IMPORT_PHONE_REGEX,
  IMPORT_TYPES,
  MAX_IMPORT_TEXT_LENGTH,
  enumMismatchMessage,
  validateStudentAcademicFields,
  type ImportRowType,
} from "@/lib/constants/user-import";

export const importTypeSchema = z.enum(IMPORT_TYPES);

export function parseImportType(value: unknown): ImportRowType | null {
  const parsed = importTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const boundedText = z
  .string()
  .trim()
  .max(MAX_IMPORT_TEXT_LENGTH, `must be at most ${MAX_IMPORT_TEXT_LENGTH} characters`);

// Import-only phone rule (stricter than the interactive form's phPhone,
// which also accepts 09XXXXXXXXX) — optional field, but must match if present.
const importPhone = z
  .string()
  .trim()
  .max(MAX_IMPORT_TEXT_LENGTH, `phoneNumber must be at most ${MAX_IMPORT_TEXT_LENGTH} characters`)
  .regex(IMPORT_PHONE_REGEX, "phoneNumber must be in format +639XXXXXXXXX, e.g. +639171234567")
  .optional()
  .or(z.literal(""));

const baseRow = {
  firstName: boundedText.min(1, "firstName is required"),
  middleName: boundedText.optional().default(""),
  lastName: boundedText.min(1, "lastName is required"),
  email: bpsuEmail
    .max(MAX_IMPORT_TEXT_LENGTH, `email must be at most ${MAX_IMPORT_TEXT_LENGTH} characters`)
    .transform((email) => email.toLowerCase()),
  phoneNumber: importPhone,
};

// Messages below are self-contained (no "see Instructions sheet" pointers) —
// the user has usually already closed the file by the time they read them.
// Enum/format checks run in .superRefine() rather than z.enum()/.regex()
// chains so an empty field reports only "X is required", never a second,
// redundant format message on top of it.
export const facultyImportRowSchema = z
  .object({
    ...baseRow,
    idNumber: boundedText.min(1, "idNumber is required"),
    department: boundedText.min(1, "department is required"),
    position: boundedText.min(1, "position is required"),
  })
  .superRefine((data, ctx) => {
    if (data.idNumber && !FACULTY_ID_REGEX.test(data.idNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["idNumber"],
        message: "idNumber must be in format 123456-1234, e.g. 202000-0001",
      });
    }
    if (data.department && !(DEPARTMENTS as readonly string[]).includes(data.department)) {
      ctx.addIssue({
        code: "custom",
        path: ["department"],
        message: enumMismatchMessage(data.department, DEPARTMENTS, "department", "valid departments"),
      });
    }
    if (data.position && !(FACULTY_POSITIONS as readonly string[]).includes(data.position)) {
      ctx.addIssue({
        code: "custom",
        path: ["position"],
        message: enumMismatchMessage(data.position, FACULTY_POSITIONS, "position", "valid ranks"),
      });
    }
  });

export const studentImportRowSchema = z
  .object({
    ...baseRow,
    idNumber: boundedText.min(1, "idNumber is required"),
    // Optional: blank is filled in from the idNumber prefix during row
    // normalization (see normalizeImportRow), so by the time this schema
    // runs it's either a value the file provided or the derived one.
    academicYear: boundedText.optional().default(""),
    course: boundedText.min(1, "course is required"),
    yearLevel: boundedText.min(1, "yearLevel is required"),
    section: boundedText.min(1, "section is required"),
  })
  .superRefine((data, ctx) => {
    // Shared academic helper is also consumed by normal Add/Edit User
    // validation, preventing the import path from developing its own rules.
    // The Zod object above owns required-field presence. The shared helper
    // contributes only format and cross-field academic semantics here, so a
    // blank field cannot surface two equivalent "required" messages.
    for (const issue of validateStudentAcademicFields(data)) {
      ctx.addIssue({
        code: "custom",
        path: [issue.field],
        message: issue.message,
        params: { importIssueCode: issue.code },
      });
    }
  });

export type FacultyImportRow = z.infer<typeof facultyImportRowSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
export type { ImportRowType };
