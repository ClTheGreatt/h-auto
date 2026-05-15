"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  facultyImportRowSchema,
  studentImportRowSchema,
  type FacultyImportRow,
  type StudentImportRow,
  type ImportRowType,
} from "@/lib/validations/import";

type RawRow = Record<string, unknown>;

export async function commitImport(
  type: ImportRowType,
  rawRows: RawRow[],
  fileName: string
) {
  await requireAdmin();
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const schema =
    type === "FACULTY" ? facultyImportRowSchema : studentImportRowSchema;

  // Re-validate on the server (never trust client)
  const validated: (FacultyImportRow | StudentImportRow)[] = [];
  const validationFailed: { email: string; reason: string }[] = [];

  for (const raw of rawRows) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      validated.push(parsed.data);
    } else {
      const email =
        typeof raw.email === "string" ? raw.email : "(missing email)";
      validationFailed.push({
        email,
        reason: parsed.error.issues
          .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
          .join("; "),
      });
    }
  }

  // Check existing emails in DB
  const emails = validated.map((r) => r.email.toLowerCase());
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));

  const created: string[] = [];
  const failed: { email: string; reason: string }[] = [...validationFailed];

  for (const row of validated) {
    if (existingEmails.has(row.email.toLowerCase())) {
      failed.push({ email: row.email, reason: "Email already exists" });
      continue;
    }

    try {
      const passwordHash = await bcrypt.hash(row.password, 10);
      const baseData = {
        email: row.email,
        firstName: row.firstName,
        middleName: row.middleName || null,
        lastName: row.lastName,
        phoneNumber: row.phoneNumber || null,
        idNumber: row.idNumber || null,
        passwordHash,
      };

      if (type === "FACULTY") {
        const f = row as FacultyImportRow;
        await prisma.user.create({
          data: {
            ...baseData,
            role: "FACULTY",
            department: f.department || null,
            position: f.position || null,
          },
        });
      } else {
        const s = row as StudentImportRow;
        await prisma.user.create({
          data: {
            ...baseData,
            role: "STUDENT_FARMER",
            course: s.course || null,
            yearLevel: s.yearLevel || null,
            section: s.section || null,
          },
        });
      }

      created.push(row.email);
    } catch (err) {
      failed.push({
        email: row.email,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  await prisma.importBatch.create({
    data: {
      userId: session.user.id,
      type: type === "FACULTY" ? "FACULTY" : "STUDENT_FARMER",
      fileName,
      totalRows: rawRows.length,
      successCount: created.length,
      failureCount: failed.length,
      status:
        failed.length === 0
          ? "COMPLETED"
          : created.length === 0
          ? "FAILED"
          : "COMPLETED_WITH_ERRORS",
      errorLog: failed.length > 0 ? (failed as Prisma.JsonArray) : undefined,
      completedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/users");

  return {
    success: created,
    failed,
    totalProcessed: rawRows.length,
  };
}