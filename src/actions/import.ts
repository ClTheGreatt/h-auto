"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmailTemplate } from "@/lib/email/templates";
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

  // Check existing emails + ID numbers in DB
  const emails = validated.map((r) => r.email.toLowerCase());
  const idNumbers = validated.map((r) => r.idNumber).filter(Boolean);
  const existing = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emails } },
        ...(idNumbers.length > 0 ? [{ idNumber: { in: idNumbers } }] : []),
      ],
    },
    select: { email: true, idNumber: true },
  });
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
  const existingIdNumbers = new Set(
    existing.map((u) => u.idNumber).filter((v): v is string => !!v)
  );

  const created: string[] = [];
  const failed: { email: string; reason: string }[] = [...validationFailed];

  for (const row of validated) {
    if (existingEmails.has(row.email.toLowerCase())) {
      failed.push({ email: row.email, reason: "Email already exists" });
      continue;
    }
    if (row.idNumber && existingIdNumbers.has(row.idNumber)) {
      failed.push({ email: row.email, reason: "ID number already exists" });
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
        mustChangePassword: true,
      };

      let createdUser;
      if (type === "FACULTY") {
        const f = row as FacultyImportRow;
        createdUser = await prisma.user.create({
          data: {
            ...baseData,
            role: "FACULTY",
            department: f.department || null,
            position: f.position || null,
          },
        });
      } else {
        const s = row as StudentImportRow;
        createdUser = await prisma.user.create({
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

      // Send welcome email (best-effort — doesn't fail the import)
      try {
        const { subject, html, text } = welcomeEmailTemplate({
          firstName: createdUser.firstName,
          email: createdUser.email,
          tempPassword: row.password,
          loginUrl:
            (process.env.AUTH_URL ?? "http://localhost:3000") + "/login",
          role: createdUser.role,
        });

        const emailResult = await sendEmail({
          to: createdUser.email,
          subject,
          html,
          text,
        });

        if ("error" in emailResult) {
          console.error(
            `[commitImport] Welcome email failed for ${createdUser.email}:`,
            emailResult.error
          );
        }
      } catch (emailError) {
        console.error("[commitImport] Welcome email exception:", emailError);
      }
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