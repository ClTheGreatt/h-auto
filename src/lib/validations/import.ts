import { z } from "zod";

const baseRow = {
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional().default(""),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email"),
  phoneNumber: z.string().trim().optional().default(""),
  idNumber: z.string().trim().optional().default(""),
  password: z.string().min(6, "Password must be at least 6 characters"),
};

export const facultyImportRowSchema = z.object({
  ...baseRow,
  department: z.string().trim().optional().default(""),
  position: z.string().trim().optional().default(""),
});

export const studentImportRowSchema = z.object({
  ...baseRow,
  course: z.string().trim().optional().default(""),
  yearLevel: z.string().trim().optional().default(""),
  section: z.string().trim().optional().default(""),
});

export type FacultyImportRow = z.infer<typeof facultyImportRowSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
export type ImportRowType = "FACULTY" | "STUDENT_FARMER";