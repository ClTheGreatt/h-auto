import { z } from "zod";
import { bpsuEmail } from "./email";
import { passwordStrengthSchema } from "./password";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  FACULTY_ID_REGEX,
  YEAR_LEVELS,
  deriveAcademicYearFromIdPrefix,
  validateStudentAcademicFields,
  type AcademicRuleIssue,
} from "@/lib/constants/user-import";

export { YEAR_LEVELS } from "@/lib/constants/user-import";

function addStudentAcademicIssues(
  data: {
    idNumber?: string;
    course?: string;
    yearLevel?: string;
    section?: string;
    academicYear?: string;
  },
  ctx: z.RefinementCtx
) {
  for (const issue of validateStudentAcademicFields(
    {
      idNumber: data.idNumber ?? "",
      course: data.course ?? "",
      yearLevel: data.yearLevel ?? "",
      section: data.section ?? "",
      academicYear: data.academicYear ?? "",
    }
  )) {
    ctx.addIssue({
      code: "custom",
      path: [issue.field],
      message: issue.message,
    });
  }
}

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

// STRICT — Student Farmer creation. Adviser request: can't add a student
// with missing required fields (EDIT stays lenient via updateUserSchema).
// idNumber/section enforce the same format rules as the bulk import (see
// src/lib/constants/user-import.ts) — same DB table, so free text here
// would let interactively-created users diverge from imported ones.
const createStudentObjectSchema = baseUserSchema.extend({
  role: z.literal("STUDENT_FARMER"),
  idNumber: z.string().trim().min(1, "ID number is required"),
  course: z.enum(DEPARTMENTS, { error: "Course is required" }),
  section: z.string().trim().min(1, "Section is required"),
  yearLevel: z.enum(YEAR_LEVELS, { error: "Year level is required" }),
  // Interactive form keeps the more lenient phPhone rule (also accepts
  // 09XXXXXXXXX) rather than the stricter IMPORT_PHONE_REGEX — a human
  // typing one number is a different case from validating a bulk file.
  phoneNumber: phPhone,
  password: passwordStrengthSchema,
});

export const createStudentSchema = createStudentObjectSchema.superRefine(
  addStudentAcademicIssues
);
export const createStudentOptionalPasswordSchema = createStudentObjectSchema
  .partial({ password: true })
  .superRefine(addStudentAcademicIssues);

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
export const createStudentWebSchema = createStudentObjectSchema
  .omit({ password: true })
  .superRefine(addStudentAcademicIssues);
export const createFacultyWebSchema = createFacultySchema.omit({ password: true });

export type CreateUserInput = z.infer<typeof createUserWebSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateStudentInput = z.infer<typeof createStudentWebSchema>;
export type CreateFacultyInput = z.infer<typeof createFacultyWebSchema>;

export type StudentAcademicState = {
  role: string;
  idNumber?: string | null;
  course?: string | null;
  yearLevel?: string | null;
  section?: string | null;
  academicYear?: string | null;
};

const STUDENT_ACADEMIC_FIELDS = [
  "idNumber",
  "course",
  "yearLevel",
  "section",
  "academicYear",
] as const;

function academicValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function studentAcademicFieldsChanged(
  existing: StudentAcademicState,
  next: StudentAcademicState
): boolean {
  return (
    existing.role !== next.role ||
    STUDENT_ACADEMIC_FIELDS.some(
      (field) => academicValue(existing[field]) !== academicValue(next[field])
    )
  );
}

export function validateStudentAcademicUpdate(
  existing: StudentAcademicState,
  next: StudentAcademicState
): {
  changed: boolean;
  academicYear: string;
  issues: AcademicRuleIssue[];
} {
  const changed = studentAcademicFieldsChanged(existing, next);
  const idNumber = academicValue(next.idNumber);
  const suppliedAcademicYear = academicValue(next.academicYear);
  const academicYear =
    suppliedAcademicYear || deriveAcademicYearFromIdPrefix(idNumber) || "";

  if (next.role !== "STUDENT_FARMER" || !changed) {
    return { changed, academicYear: suppliedAcademicYear, issues: [] };
  }

  return {
    changed,
    academicYear,
    issues: validateStudentAcademicFields(
      {
        idNumber,
        course: academicValue(next.course),
        yearLevel: academicValue(next.yearLevel),
        section: academicValue(next.section),
        academicYear,
      },
      { requireComplete: true }
    ),
  };
}
