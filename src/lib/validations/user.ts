import { z } from "zod";
import { bpsuEmail } from "./email";
import { passwordStrengthSchema } from "./password";

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
  position: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// Used for ADMIN/SUPER_ADMIN creation and as the base for updates. Password
// strength is unified across every creation path via passwordStrengthSchema.
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

// STRICT — Student Farmer creation. Adviser request: can't add a student
// with missing required fields (EDIT stays lenient via updateUserSchema).
export const createStudentSchema = baseUserSchema.extend({
  role: z.literal("STUDENT_FARMER"),
  idNumber: z.string().trim().min(1, "ID number is required"),
  course: z.string().trim().min(1, "Course is required"),
  section: z.string().trim().min(1, "Section is required"),
  yearLevel: z.enum(YEAR_LEVELS, { error: "Year level is required" }),
  phoneNumber: phPhone,
  password: passwordStrengthSchema,
});

// STRICT — Faculty creation. Same rationale as createStudentSchema.
export const createFacultySchema = baseUserSchema.extend({
  role: z.literal("FACULTY"),
  idNumber: z.string().trim().min(1, "Employee ID is required"),
  department: z.string().trim().min(1, "Department is required"),
  position: z.string().trim().min(1, "Position is required"),
  password: passwordStrengthSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type CreateFacultyInput = z.infer<typeof createFacultySchema>;