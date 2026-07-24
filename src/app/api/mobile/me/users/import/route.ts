import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
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

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

type RawRow = Record<string, unknown>;

// POST /api/mobile/me/users/import — bulk create from parsed CSV rows (admin only)
export async function POST(req: NextRequest) {
  const actor = await getMobileUser(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { type?: string; rows?: RawRow[]; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const type = body.type as ImportRowType;
  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  const fileName =
    typeof body.fileName === "string" ? body.fileName : "import.csv";

  if (type !== "FACULTY" && type !== "STUDENT_FARMER") {
    return NextResponse.json(
      { error: "type must be FACULTY or STUDENT_FARMER" },
      { status: 400 }
    );
  }
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const schema =
    type === "FACULTY" ? facultyImportRowSchema : studentImportRowSchema;

  // Re-validate on the server (never trust the client)
  const validated: (FacultyImportRow | StudentImportRow)[] = [];
  const validationFailed: { email: string; reason: string }[] = [];

  for (const raw of rawRows) {
    // Normalize first — a column the mobile client's CSV omitted entirely
    // must reach the schema as "", never `undefined`, or Zod's own
    // "expected string, received undefined" leaks through unformatted.
    const normalized = normalizeImportRow(raw, type);
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

  // Skip emails that already exist
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

      // Welcome email (best-effort — won't fail the import)
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
            `[mobile import] welcome email failed for ${createdUser.email}:`,
            emailResult.error
          );
        }
      } catch (emailError) {
        console.error("[mobile import] welcome email exception:", emailError);
      }
    } catch (err) {
      failed.push({
        email: row.email,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Record the batch (don't fail the response if logging fails)
  try {
    await prisma.importBatch.create({
      data: {
        userId: actor.id,
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
  } catch (err) {
    console.error("[mobile import] importBatch create failed:", err);
  }

  return NextResponse.json({
    success: created,
    failed,
    totalProcessed: rawRows.length,
  });
}