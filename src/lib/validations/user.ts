import { z } from "zod";
import { bpsuEmail } from "./email";

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
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});

export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const updateUserSchema = baseUserSchema.extend({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;