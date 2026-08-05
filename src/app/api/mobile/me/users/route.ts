import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import {
  createUserSchema,
  createStudentSchema,
  createFacultySchema,
} from "@/lib/validations/user";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { generateTempPassword } from "@/lib/auth/generate-password";
import { stripInactivePrefix } from "@/lib/users/inactive-prefix";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const VALID_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FACULTY",
  "STUDENT_FARMER",
];
const VALID_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE"];

// STUDENT_FARMER / FACULTY get strict, role-specific validation (same
// rule as the web createUser action). Other roles (ADMIN/SUPER_ADMIN)
// keep the lenient schema.
//
// TEMPPASS-1 backward compatibility: `password` is made optional here
// (still validated with the same passwordStrengthSchema whenever it IS
// supplied — .partial() only wraps the field in .optional(), it doesn't
// relax the rule) so this one endpoint serves both the pre-rebuild APK
// (always sends an admin-typed password) and the rebuilt APK (omits it,
// expects the server to generate one — see the POST handler below). Once
// the rebuilt APK has fully shipped, remove these *OptionalPassword
// variants and go back to returning createUserSchema/createStudentSchema/
// createFacultySchema directly.
const createUserSchemaOptionalPassword = createUserSchema.partial({
  password: true,
});
const createStudentSchemaOptionalPassword = createStudentSchema.partial({
  password: true,
});
const createFacultySchemaOptionalPassword = createFacultySchema.partial({
  password: true,
});

function pickCreateSchema(role: unknown) {
  if (role === "STUDENT_FARMER") return createStudentSchemaOptionalPassword;
  if (role === "FACULTY") return createFacultySchemaOptionalPassword;
  return createUserSchemaOptionalPassword;
}

// Maps Prisma unique-constraint errors to friendly messages (same idea as web)
function handlePrismaError(error: unknown): string | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const field = (error.meta?.target as string[] | undefined)?.[0];
    switch (field) {
      case "email":
        return "This email is already used by another account.";
      case "idNumber":
        return "This ID number is already registered to another user.";
      case "phoneNumber":
        return "This phone number is already used by another account.";
      default:
        return "A user with this information already exists.";
    }
  }
  return null;
}

// GET /api/mobile/me/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const roleParam = sp.get("role");
    const statusParam = sp.get("status");
    // Active/Graduated tab (mirrors the web Users page): a graduated
    // student can still be status=ACTIVE (orthogonal to status), so
    // "active" means graduatedAt IS null, not status=ACTIVE. Absent/other
    // values apply no graduatedAt filter at all (today's default).
    const view = sp.get("view");

    const where: Prisma.UserWhereInput = {
      ...(roleParam && VALID_ROLES.includes(roleParam as UserRole)
        ? { role: roleParam as UserRole }
        : {}),
      ...(statusParam && VALID_STATUSES.includes(statusParam as UserStatus)
        ? { status: statusParam as UserStatus }
        : {}),
      ...(view === "active" ? { graduatedAt: null } : {}),
      ...(view === "graduated" ? { graduatedAt: { not: null } } : {}),
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        department: true,
        idNumber: true,
        profileImage: true,
        lastLoginAt: true,
        createdAt: true,
        graduatedAt: true,
        academicYear: true,
        // Needed for the Course > Year > Section grouping on the mobile
        // Users list (student rows only; null for every other role).
        course: true,
        yearLevel: true,
        section: true,
      },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        // Read-path only: deactivateUser() prefixes email with
        // inactive_<timestamp>_ to free the unique constraint. A client has
        // no use for that internal encoding — status is already returned,
        // so "this account is inactive" is knowable without leaking it.
        email: stripInactivePrefix(u.email),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        graduatedAt: u.graduatedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[mobile/me/users GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/mobile/me/users — create new user (admin only)
export async function POST(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // --- Mobile role-creation permission rules ---
    // Nobody creates SUPER_ADMIN from mobile.
    if (body.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin accounts can't be created from mobile" },
        { status: 403 }
      );
    }
    // Only SUPER_ADMIN can create ADMIN.
    if (body.role === "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admins can create Admin accounts" },
        { status: 403 }
      );
    }

    // Validate with the SAME role-based schema as the web createUser
    // action: strict for STUDENT_FARMER/FACULTY, lenient fallback
    // otherwise. Default status to ACTIVE.
    const schema = pickCreateSchema(body.role);
    const parsed = schema.safeParse({
      ...body,
      status: body.status || "ACTIVE",
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        Object.values(fieldErrors).flat().find(Boolean) ?? "Invalid input";
      return NextResponse.json(
        { error: firstError, fieldErrors },
        { status: 400 }
      );
    }

    const { password: suppliedPassword, ...rest } = parsed.data;
    // TEMPPASS-1: when the admin didn't supply a password, generate one —
    // mirrors web's createUser action. The generated password is never run
    // through passwordStrengthSchema: its format (Hauto-XXXX-XXXX, all
    // uppercase letters + digits) doesn't satisfy the lowercase-letter
    // rule, exactly like web never validates its generated password either.
    const serverGeneratedPassword = suppliedPassword === undefined;
    const password = suppliedPassword ?? generateTempPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    let created;
    try {
      created = await prisma.user.create({
        data: {
          ...rest,
          email: rest.email.toLowerCase(),
          middleName: rest.middleName || null,
          phoneNumber: rest.phoneNumber || null,
          idNumber: rest.idNumber || null,
          department: rest.department || null,
          course: rest.course || null,
          yearLevel: rest.yearLevel || null,
          section: rest.section || null,
          academicYear: rest.academicYear || null,
          position: rest.position || null,
          passwordHash,
          mustChangePassword: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
    } catch (error) {
      const friendly = handlePrismaError(error);
      if (friendly) {
        return NextResponse.json({ error: friendly }, { status: 409 });
      }
      console.error("[mobile/me/users POST] create error:", error);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // Welcome email — best-effort, same as web (don't fail creation if it errors)
    try {
      const { subject, html, text } = welcomeEmailTemplate({
        firstName: created.firstName,
        email: created.email,
        tempPassword: password,
        loginUrl: (process.env.AUTH_URL ?? "http://localhost:3000") + "/login",
        role: created.role,
      });

      const emailResult = await sendEmail({
        to: created.email,
        subject,
        html,
        text,
      });

      if ("error" in emailResult) {
        console.error(
          `[mobile/me/users POST] welcome email failed for ${created.email}:`,
          emailResult.error
        );
      }
    } catch (emailError) {
      console.error(
        "[mobile/me/users POST] welcome email exception:",
        emailError
      );
    }

    // tempPassword is additive and only present when the server generated
    // it — an admin-supplied password is never echoed back.
    return NextResponse.json({
      user: created,
      ...(serverGeneratedPassword ? { tempPassword: password } : {}),
    });
  } catch (error) {
    console.error("[mobile/me/users POST] error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}