import { z } from "zod";
import { bpsuEmail } from "./email";
import { passwordStrengthSchema } from "./password";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  FACULTY_ID_REGEX,
  STUDENT_ID_REGEX,
  SECTION_REGEX,
  IMPORT_PHONE_REGEX,
  studentIdPrefixRange,
} from "@/lib/constants/user-import";

// Import-only phone rule (stricter than the interactive form's phPhone,
// which also accepts 09XXXXXXXXX) — optional field, but must match if present.
const importPhone = z
  .string()
  .trim()
  .regex(IMPORT_PHONE_REGEX, "Phone must be in format +639XXXXXXXXX")
  .optional()
  .or(z.literal(""));

const baseRow = {
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional().default(""),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: bpsuEmail,
  phoneNumber: importPhone,
  password: passwordStrengthSchema,
};

const { min: studentIdMin, max: studentIdMax } = studentIdPrefixRange();

export const facultyImportRowSchema = z.object({
  ...baseRow,
  idNumber: z
    .string()
    .trim()
    .min(1, "Employee ID is required")
    .regex(FACULTY_ID_REGEX, "Employee ID must be in format 123456-1234"),
  department: z.enum(DEPARTMENTS, {
    error: "Department must be one of the official department names (see Instructions sheet)",
  }),
  position: z.enum(FACULTY_POSITIONS, {
    error: "Position must be one of the 18 official faculty ranks (see Instructions sheet)",
  }),
});

export const studentImportRowSchema = z.object({
  ...baseRow,
  idNumber: z
    .string()
    .trim()
    .min(1, "Student ID is required")
    .regex(STUDENT_ID_REGEX, "Student ID must be in format 12-34567")
    .refine(
      (val) => {
        const prefix = parseInt(val.slice(0, 2), 10);
        return prefix >= studentIdMin && prefix <= studentIdMax;
      },
      { message: `Student ID prefix must be between ${studentIdMin} and ${studentIdMax}` }
    ),
  course: z.enum(DEPARTMENTS, {
    error: "Course must be one of the official program names (see Instructions sheet)",
  }),
  yearLevel: z.string().trim().optional().default(""),
  section: z
    .string()
    .trim()
    .min(1, "Section is required")
    .regex(SECTION_REGEX, "Section must match e.g. BSA-1A, BTVTED-2B, BSABE-3C"),
});

export type FacultyImportRow = z.infer<typeof facultyImportRowSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
export type ImportRowType = "FACULTY" | "STUDENT_FARMER";