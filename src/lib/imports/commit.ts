import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import {
  facultyImportRowSchema,
  studentImportRowSchema,
  type FacultyImportRow,
  type StudentImportRow,
  type ImportRowType,
} from "@/lib/validations/import";
import { normalizeImportRow, formatZodIssue } from "@/lib/imports/parse-rows";

// Shared by the web server action (src/actions/import.ts) and the mobile
// API route (src/app/api/mobile/me/users/import/route.ts) — the same
// discipline that keeps parse-rows.ts safe applies here: no "use server",
// no "use client". Auth and revalidatePath are the CALLER's job; this
// function only ever receives an already-authorized actorId.

type RawRow = Record<string, unknown>;

export type ImportRowFailure = { email: string; reason: string };

export type CommitImportParams = {
  rows: RawRow[];
  importType: ImportRowType;
  actorId: string;
  fileName: string;
};

export type CommitImportResult = {
  created: string[];
  failed: ImportRowFailure[];
  totalProcessed: number;
  // null when the ImportBatch audit record itself failed to write — the
  // users above were still created successfully; see the try/catch below.
  batchId: string | null;
};

export async function commitImportRows({
  rows,
  importType,
  actorId,
  fileName,
}: CommitImportParams): Promise<CommitImportResult> {
  const schema =
    importType === "FACULTY" ? facultyImportRowSchema : studentImportRowSchema;

  const validated: (FacultyImportRow | StudentImportRow)[] = [];
  const validationFailed: ImportRowFailure[] = [];

  for (const raw of rows) {
    const normalized = normalizeImportRow(raw, importType);
    const parsed = schema.safeParse(normalized);
    if (parsed.success) {
      validated.push(parsed.data);
    } else {
      const email =
        typeof raw.email === "string" ? raw.email : "(missing email)";
      validationFailed.push({
        email,
        reason: parsed.error.issues.map(formatZodIssue).join("; "),
      });
    }
  }

  // ALIGNMENT (intentional behavior change vs. the old mobile route): check
  // BOTH email and idNumber for duplicates, not email only. This makes
  // mobile stricter than it was — matching the web action's existing
  // behavior, which already checked both.
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
  const failed: ImportRowFailure[] = [...validationFailed];

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
      if (importType === "FACULTY") {
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
            academicYear: s.academicYear || null,
          },
        });
      }

      created.push(row.email);

      // Welcome email — best-effort, per-row, in-loop. A failed send must
      // NOT fail the row and must NOT roll back the created user.
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
            `[commitImportRows] Welcome email failed for ${createdUser.email}:`,
            emailResult.error
          );
        }
      } catch (emailError) {
        console.error("[commitImportRows] Welcome email exception:", emailError);
      }
    } catch (err) {
      failed.push({
        email: row.email,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Resolved divergence: the old web action let a batch-log failure crash
  // the whole import even though every user above was already created;
  // the old mobile route tolerated it. Taking mobile's tolerant behavior
  // for the shared core — an audit-log write failing is not a reason to
  // report a false error on an otherwise-successful import.
  let batchId: string | null = null;
  try {
    const batch = await prisma.importBatch.create({
      data: {
        userId: actorId,
        type: importType === "FACULTY" ? "FACULTY" : "STUDENT_FARMER",
        fileName,
        totalRows: rows.length,
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
    batchId = batch.id;
  } catch (err) {
    console.error("[commitImportRows] importBatch create failed:", err);
  }

  return {
    created,
    failed,
    totalProcessed: rows.length,
    batchId,
  };
}
