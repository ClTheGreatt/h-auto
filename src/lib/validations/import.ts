import { z } from "zod";
import { bpsuEmail } from "./email";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  FACULTY_ID_REGEX,
  STUDENT_ID_REGEX,
  SECTION_REGEX,
  IMPORT_PHONE_REGEX,
  studentIdPrefixRange,
  isValidStudentIdPrefix,
  enumMismatchMessage,
  type ImportRowType,
} from "@/lib/constants/user-import";

// Import-only phone rule (stricter than the interactive form's phPhone,
// which also accepts 09XXXXXXXXX) — optional field, but must match if present.
const importPhone = z
  .string()
  .trim()
  .regex(IMPORT_PHONE_REGEX, "phoneNumber must be in format +639XXXXXXXXX, e.g. +639171234567")
  .optional()
  .or(z.literal(""));

const baseRow = {
  firstName: z.string().trim().min(1, "firstName is required"),
  middleName: z.string().trim().optional().default(""),
  lastName: z.string().trim().min(1, "lastName is required"),
  email: bpsuEmail,
  phoneNumber: importPhone,
};

const { min: studentIdMin, max: studentIdMax } = studentIdPrefixRange();

// Messages below are self-contained (no "see Instructions sheet" pointers) —
// the user has usually already closed the file by the time they read them.
// Enum/format checks run in .superRefine() rather than z.enum()/.regex()
// chains so an empty field reports only "X is required", never a second,
// redundant format message on top of it.
export const facultyImportRowSchema = z
  .object({
    ...baseRow,
    idNumber: z.string().trim().min(1, "idNumber is required"),
    department: z.string().trim().min(1, "department is required"),
    position: z.string().trim().min(1, "position is required"),
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
    idNumber: z.string().trim().min(1, "idNumber is required"),
    // Optional: blank is filled in from the idNumber prefix during row
    // normalization (see normalizeImportRow), so by the time this schema
    // runs it's either a value the file provided or the derived one.
    academicYear: z.string().trim().optional().default(""),
    course: z.string().trim().min(1, "course is required"),
    yearLevel: z.string().trim().optional().default(""),
    section: z.string().trim().min(1, "section is required"),
  })
  .superRefine((data, ctx) => {
    if (data.idNumber) {
      if (!STUDENT_ID_REGEX.test(data.idNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["idNumber"],
          message: "idNumber must be in format 12-34567, e.g. 23-04567",
        });
      } else if (!isValidStudentIdPrefix(data.idNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["idNumber"],
          message: `idNumber prefix must be between ${studentIdMin} and ${studentIdMax}`,
        });
      }
    }
    if (data.course && !(DEPARTMENTS as readonly string[]).includes(data.course)) {
      ctx.addIssue({
        code: "custom",
        path: ["course"],
        message: enumMismatchMessage(data.course, DEPARTMENTS, "course", "valid programs"),
      });
    }
    if (data.section && !SECTION_REGEX.test(data.section)) {
      ctx.addIssue({
        code: "custom",
        path: ["section"],
        message: "section must be in format PREFIX-YN, e.g. BSA-1A, BTVTED-2B, BSABE-3C",
      });
    }
  });

export type FacultyImportRow = z.infer<typeof facultyImportRowSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
export type { ImportRowType };
