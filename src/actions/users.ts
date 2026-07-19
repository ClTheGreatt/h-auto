"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import {
  createUserSchema,
  createStudentSchema,
  createFacultySchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user";
import { isInactivePrefixed, stripInactivePrefix } from "@/lib/users/inactive-prefix";

// STUDENT_FARMER / FACULTY get strict, role-specific validation (adviser
// request). Other roles (ADMIN/SUPER_ADMIN) keep the lenient schema.
function pickCreateSchema(role: unknown) {
  if (role === "STUDENT_FARMER") return createStudentSchema;
  if (role === "FACULTY") return createFacultySchema;
  return createUserSchema;
}

// Maps Prisma unique constraint field names to user-friendly messages
function handlePrismaError(error: unknown): { error: string } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target as string[] | undefined;
      const field = target?.[0];

      switch (field) {
        case "email":
          return { error: "This email is already used by another account." };
        case "idNumber":
          return {
            error: "This ID number is already registered to another user.",
          };
        case "phoneNumber":
          return {
            error: "This phone number is already used by another account.",
          };
        default:
          return { error: "A user with this information already exists." };
      }
    }
  }
  return null;
}

export async function createUser(input: CreateUserInput) {
  await requireAdmin();

  const schema = pickCreateSchema(input?.role);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // Keep the plaintext password — we need it for the welcome email
  const { password, ...rest } = parsed.data;

  let createdUser;
  try {
    createdUser = await prisma.user.create({
      data: {
        ...rest,
        middleName: rest.middleName || null,
        phoneNumber: rest.phoneNumber || null,
        idNumber: rest.idNumber || null,
        department: rest.department || null,
        course: rest.course || null,
        yearLevel: rest.yearLevel || null,
        section: rest.section || null,
        position: rest.position || null,
        passwordHash,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    const friendly = handlePrismaError(error);
    if (friendly) return friendly;
    console.error("createUser error:", error);
    return { error: "Failed to create user. Please try again." };
  }

  // Send welcome email (best-effort — don't fail user creation if email fails)
  try {
    const { subject, html, text } = welcomeEmailTemplate({
      firstName: createdUser.firstName,
      email: createdUser.email,
      tempPassword: password,
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
        `[createUser] Welcome email failed for ${createdUser.email}:`,
        emailResult.error
      );
    }
  } catch (emailError) {
    console.error("[createUser] Welcome email exception:", emailError);
  }

  revalidatePath("/dashboard/users");
  return { success: true, id: createdUser.id };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await requireAdmin();

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { status: true, email: true },
  });
  if (!existingUser) {
    return { error: "User not found" };
  }

  const { password, ...rest } = parsed.data;

  const updateData: Record<string, unknown> = {
    ...rest,
    middleName: rest.middleName || null,
    phoneNumber: rest.phoneNumber || null,
    idNumber: rest.idNumber || null,
    department: rest.department || null,
    course: rest.course || null,
    yearLevel: rest.yearLevel || null,
    section: rest.section || null,
    position: rest.position || null,
  };

  // Reactivation: INACTIVE -> ACTIVE. Restore the original email (stripping
  // whatever inactive_<timestamp>_ / inactive::<timestamp>:: prefix is
  // present) so the account is usable again. Only intervenes when the
  // stored email is actually prefixed — an INACTIVE user whose email was
  // never touched (e.g. deactivated by hand outside deactivateUser)
  // reactivates normally with no extra check.
  const isReactivating =
    existingUser.status === "INACTIVE" && rest.status === "ACTIVE";

  if (isReactivating && isInactivePrefixed(existingUser.email)) {
    // stripInactivePrefix() is a no-op on an email the admin already typed
    // something clean into, so this is safe to apply unconditionally.
    const finalEmail = stripInactivePrefix(rest.email);

    const conflict = await prisma.user.findFirst({
      where: {
        email: { equals: finalEmail, mode: "insensitive" },
        id: { not: id },
        status: "ACTIVE",
      },
    });

    if (conflict) {
      return {
        error: `Cannot reactivate: another active user (${conflict.firstName} ${conflict.lastName}) is using ${finalEmail}. Please provide a new email.`,
      };
    }

    updateData.email = finalEmail;
  }

  // Bump tokenVersion whenever this update could otherwise leave a stale
  // session/token with access it shouldn't have: a password reset, the
  // account being deactivated, or being reactivated (safety — invalidate
  // any stale token left over from before deactivation).
  let bumpTokenVersion = false;

  if (password && password.length > 0) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
    updateData.mustChangePassword = true;
    bumpTokenVersion = true;
  }

  if (rest.status === "INACTIVE" || isReactivating) {
    bumpTokenVersion = true;
  }

  if (bumpTokenVersion) {
    updateData.tokenVersion = { increment: 1 };
  }

  try {
    await prisma.user.update({ where: { id }, data: updateData });
  } catch (error) {
    const friendly = handlePrismaError(error);
    if (friendly) return friendly;
    console.error("updateUser error:", error);
    return { error: "Failed to update user. Please try again." };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

/**
 * Soft-deactivates a user account. Sets status to INACTIVE, renames the
 * email to free it up for future registrations, and increments tokenVersion
 * to invalidate any active session.
 *
 * Historical data (plots, growth logs, alerts, assignments) is preserved.
 * To reactivate: admin edits the user's profile and manually restores the
 * email (remove the inactive_<timestamp>_ prefix) plus sets status back to ACTIVE.
 *
 * (Renamed from deleteUser — a real prisma.user.delete() is still attempted
 * first and succeeds when the user has no related records; the above only
 * describes the far more common fallback path.)
 */
export async function deactivateUser(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    return { error: "You cannot delete your own account" };
  }

  // Try permanent delete first (works if user has no related records)
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/dashboard/users");
    return { success: true, mode: "deleted" };
  } catch (error) {
    // Foreign key constraint = user has associated records (logs, assignments, etc.)
    // Fall back to soft delete: deactivate to preserve history.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      try {
        const target = await prisma.user.findUnique({
          where: { id },
          select: { email: true },
        });
        if (!target) {
          return { error: "User not found" };
        }

        // Prefix the email so it's freed up for a future registration —
        // otherwise the unique constraint on email blocks re-signup under
        // the same address. Also bump tokenVersion to invalidate any
        // session/token this account currently holds.
        const inactiveEmail = `inactive_${Date.now()}_${target.email}`;
        await prisma.user.update({
          where: { id },
          data: {
            status: "INACTIVE",
            email: inactiveEmail,
            tokenVersion: { increment: 1 },
          },
        });
        revalidatePath("/dashboard/users");
        return {
          success: true,
          mode: "deactivated",
          message:
            "User has historical records, so they were deactivated instead of deleted. Their data remains intact.",
        };
      } catch (innerError) {
        console.error("Soft delete fallback failed:", innerError);
      }
    }

    console.error("deactivateUser error:", error);
    return {
      error:
        "Failed to deactivate user. Please contact your administrator if this persists.",
    };
  }
}