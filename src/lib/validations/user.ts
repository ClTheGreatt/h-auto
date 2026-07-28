import { z } from "zod";
import { bpsuEmail } from "./email";
import { passwordStrengthSchema } from "./password";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  FACULTY_ID_REGEX,
  STUDENT_ID_REGEX,
  SECTION_REGEX,
  studentIdPrefixRange,
  isValidStudentIdPrefix,
} from "@/lib/constants/user-import";

const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().or(z.literal("")),
  lastName: z.string().min(1, "Last name is required"),
  email: bpsuEmail,
  phoneNumber: z.string().optional().or(z.literal("")),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "FACULTY", "STUDENT_FARMER"]),
  idNumber: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  course: z.string().optional().or(z.literal("")),
  yearLevel: z.string().optional().or(z.literal("")),
  section: z.string().optional().or(z.literal("")),
  academicYear: z.string().optional().or(z.literal("")),
  position: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// Used for ADMIN/SUPER_ADMIN creation. Also consumed as-is by the mobile
// create-user route (src/app/api/mobile/me/users/route.ts) — mobile still
// collects an admin-typed password (out of scope for this batch; see the
// *WebSchema variants below for the web form's generated-password flow).
export const createUserSchema = baseUserSchema.extend({
  password: passwordStrengthSchema,
});

// Update stays lenient on every other field for every role — an adviser
// request so existing incomplete users can still be edited/completed
// incrementally. Password itself still uses the same strength rule
// whenever a new one is actually being set (blank = keep current).
export const updateUserSchema = baseUserSchema.extend({
  password: passwordStrengthSchema.optional().or(z.literal("")),
});

export const phPhone = z
  .string()
  .regex(/^(09\d{9}|\+639\d{9})$/, "Phone must be 09XXXXXXXXX or +639XXXXXXXXX");

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

const { min: STUDENT_ID_MIN, max: STUDENT_ID_MAX } = studentIdPrefixRange();

// STRICT — Student Farmer creation. Adviser request: can't add a student
// with missing required fields (EDIT stays lenient via updateUserSchema).
// idNumber/section enforce the same format rules as the bulk import (see
// src/lib/constants/user-import.ts) — same DB table, so free text here
// would let interactively-created users diverge from imported ones.
export const createStudentSchema = baseUserSchema.extend({
  role: z.literal("STUDENT_FARMER"),
  idNumber: z
    .string()
    .trim()
    .min(1, "ID number is required")
    .superRefine((val, ctx) => {
      if (!val) return;
      if (!STUDENT_ID_REGEX.test(val)) {
        ctx.addIssue({
          code: "custom",
          message: "ID number must be in format 12-34567, e.g. 23-04567",
        });
        return;
      }
      if (!isValidStudentIdPrefix(val)) {
        ctx.addIssue({
          code: "custom",
          message: `ID number prefix must be between ${STUDENT_ID_MIN} and ${STUDENT_ID_MAX}`,
        });
      }
    }),
  course: z.enum(DEPARTMENTS, { error: "Course is required" }),
  section: z
    .string()
    .trim()
    .min(1, "Section is required")
    .superRefine((val, ctx) => {
      if (!val) return;
      if (!SECTION_REGEX.test(val)) {
        ctx.addIssue({
          code: "custom",
          message: "Section must be in format PREFIX-YN, e.g. BSA-1A, BTVTED-2B, BSABE-3C",
        });
      }
    }),
  yearLevel: z.enum(YEAR_LEVELS, { error: "Year level is required" }),
  // Interactive form keeps the more lenient phPhone rule (also accepts
  // 09XXXXXXXXX) rather than the stricter IMPORT_PHONE_REGEX — a human
  // typing one number is a different case from validating a bulk file.
  phoneNumber: phPhone,
  password: passwordStrengthSchema,
});

// STRICT — Faculty creation. Same rationale as createStudentSchema.
export const createFacultySchema = baseUserSchema.extend({
  role: z.literal("FACULTY"),
  idNumber: z
    .string()
    .trim()
    .min(1, "Employee ID is required")
    .superRefine((val, ctx) => {
      if (!val) return;
      if (!FACULTY_ID_REGEX.test(val)) {
        ctx.addIssue({
          code: "custom",
          message: "Employee ID must be in format 123456-1234, e.g. 202000-0001",
        });
      }
    }),
  department: z.enum(DEPARTMENTS, { error: "Department is required" }),
  position: z.enum(FACULTY_POSITIONS, { error: "Position is required" }),
  password: passwordStrengthSchema,
});

// Web create form (Batch 2F): the admin no longer types a password —
// createUser() generates one server-side instead. Derived via .omit so
// every other field's validation rule can never drift from the mobile
// (still password-collecting) schemas above.
export const createUserWebSchema = createUserSchema.omit({ password: true });
export const createStudentWebSchema = createStudentSchema.omit({ password: true });
export const createFacultyWebSchema = createFacultySchema.omit({ password: true });

export type CreateUserInput = z.infer<typeof createUserWebSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateStudentInput = z.infer<typeof createStudentWebSchema>;
export type CreateFacultyInput = z.infer<typeof createFacultyWebSchema>;