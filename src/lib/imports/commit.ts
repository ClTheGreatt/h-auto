import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { generateTempPassword } from "@/lib/auth/generate-password";
import {
  preflightImportRows,
  type ExistingIdentityLookup,
  type ServerImportRow,
} from "@/lib/imports/preflight";
import type {
  FacultyImportRow,
  StudentImportRow,
} from "@/lib/validations/import";

export type ImportRowFailure = {
  rowNumber: number;
  email: string;
  reason: string;
};

export type CreatedCredential = {
  email: string;
  firstName: string;
  lastName: string;
  tempPassword: string;
};

export type CommitImportParams = {
  rows: ServerImportRow[];
  importType: unknown;
  actorId: string;
  fileName: string;
  lookup?: ExistingIdentityLookup;
};

export type CommitImportResult = {
  created: string[];
  credentials: CreatedCredential[];
  failed: ImportRowFailure[];
  totalProcessed: number;
  batchId: string | null;
};

export type CommitImportFailure = { error: string };

export function buildImportAuditData(input: {
  actorId: string;
  importType: "FACULTY" | "STUDENT_FARMER";
  fileName: string;
  totalRows: number;
  successCount: number;
  failed: ImportRowFailure[];
}) {
  return {
    userId: input.actorId,
    type: input.importType,
    fileName: input.fileName,
    totalRows: input.totalRows,
    successCount: input.successCount,
    failureCount: input.failed.length,
    status:
      input.failed.length === 0
        ? ("COMPLETED" as const)
        : input.successCount === 0
          ? ("FAILED" as const)
          : ("COMPLETED_WITH_ERRORS" as const),
    errorLog:
      input.failed.length > 0
        ? (input.failed.map(({ rowNumber, email, reason }) => ({
            rowNumber,
            email,
            reason,
          })) as Prisma.JsonArray)
        : undefined,
    completedAt: new Date(),
  };
}

export function friendlyImportUniqueConflict(error: unknown): string | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  if (fields.includes("email")) return "Email already exists.";
  if (fields.includes("idNumber")) return "ID Number already exists.";
  if (fields.includes("phoneNumber")) return "Phone number already exists.";
  return "A user with one of these unique account details already exists.";
}

export async function commitImportRows({
  rows,
  importType,
  actorId,
  fileName,
  lookup,
}: CommitImportParams): Promise<CommitImportResult | CommitImportFailure> {
  const preflight = await preflightImportRows(importType, rows, lookup);
  if ("error" in preflight) return preflight;

  const created: string[] = [];
  const credentials: CreatedCredential[] = [];
  const failed: ImportRowFailure[] = preflight.rows
    .filter((row) => !row.eligible)
    .map((row) => ({
      rowNumber: row.rowNumber,
      email: row.raw.email || "(missing email)",
      reason: row.issues.map((issue) => issue.message).join("; "),
    }));

  for (const rowResult of preflight.rows) {
    if (!rowResult.eligible || !rowResult.validated) continue;
    const row = rowResult.validated;

    try {
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const baseData = {
        email: row.email.toLowerCase(),
        firstName: row.firstName,
        middleName: row.middleName || null,
        lastName: row.lastName,
        phoneNumber: row.phoneNumber || null,
        idNumber: row.idNumber || null,
        passwordHash,
        mustChangePassword: true,
      };

      const createdUser =
        preflight.importType === "FACULTY"
          ? await prisma.user.create({
              data: {
                ...baseData,
                role: "FACULTY",
                department: (row as FacultyImportRow).department,
                position: (row as FacultyImportRow).position,
              },
            })
          : await prisma.user.create({
              data: {
                ...baseData,
                role: "STUDENT_FARMER",
                course: (row as StudentImportRow).course,
                yearLevel: (row as StudentImportRow).yearLevel,
                section: (row as StudentImportRow).section,
                academicYear: (row as StudentImportRow).academicYear || null,
              },
            });

      created.push(createdUser.email);
      credentials.push({
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        tempPassword,
      });

      try {
        const { subject, html, text } = welcomeEmailTemplate({
          firstName: createdUser.firstName,
          email: createdUser.email,
          tempPassword,
          loginUrl: (process.env.AUTH_URL ?? "http://localhost:3000") + "/login",
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
    } catch (error) {
      const friendly = friendlyImportUniqueConflict(error);
      if (!friendly) {
        console.error(
          `[commitImportRows] create failed for row ${rowResult.rowNumber}:`,
          error
        );
      }
      failed.push({
        rowNumber: rowResult.rowNumber,
        email: row.email,
        reason: friendly ?? "Failed to create user. Please try again.",
      });
    }
  }

  let batchId: string | null = null;
  try {
    const batch = await prisma.importBatch.create({
      data: buildImportAuditData({
        actorId,
        importType: preflight.importType,
        fileName,
        totalRows: preflight.totalRows,
        successCount: created.length,
        failed,
      }),
    });
    batchId = batch.id;
  } catch (error) {
    console.error("[commitImportRows] importBatch create failed:", error);
  }

  return {
    created,
    credentials,
    failed,
    totalProcessed: preflight.totalRows,
    batchId,
  };
}
