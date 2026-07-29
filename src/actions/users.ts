"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, canAssignRole, canManageUser } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { generateTempPassword } from "@/lib/auth/generate-password";
import {
  createUserWebSchema,
  createStudentWebSchema,
  createFacultyWebSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user";
import { isInactivePrefixed, stripInactivePrefix } from "@/lib/users/inactive-prefix";

// STUDENT_FARMER / FACULTY get strict, role-specific validation (adviser
// request). Other roles (ADMIN/SUPER_ADMIN) keep the lenient schema. Web
// only — createUser() generates the password, so these are the *WebSchema
// variants (no password field). Mobile's create-user route uses its own
// password-collecting schemas directly from @/lib/validations/user.
function pickCreateSchema(role: unknown) {
  if (role === "STUDENT_FARMER") return createStudentWebSchema;
  if (role === "FACULTY") return createFacultyWebSchema;
  return createUserWebSchema;
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

// Explicit return type — without it, TS infers a union from this function's
// many distinct `return {error:...}` object literals, and its "pad every
// sibling member with `id?: undefined`/`tempPassword?: undefined`" behavior
// turned out to be inconsistent across members (some got padded, some
// didn't), breaking property access in every caller unpredictably. An
// explicit, unpadded union makes "in"-based narrowing the correct and only
// way to access these fields — see user-form.tsx.
type CreateUserResult =
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }
  | { success: true; id: string; tempPassword: string };

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const session = await requireAdmin();

  const schema = pickCreateSchema(input?.role);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!canAssignRole(session.user.role, parsed.data.role)) {
    return { error: "Only a Super Admin can create Admin or Super Admin accounts." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const rest = parsed.data;

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
        academicYear: rest.academicYear || null,
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
        `[createUser] Welcome email failed for ${createdUser.email}:`,
        emailResult.error
      );
    }
  } catch (emailError) {
    console.error("[createUser] Welcome email exception:", emailError);
  }

  revalidatePath("/dashboard/users");
  // tempPassword is additive, show-once: the caller displays it exactly
  // once and must never persist or log it further.
  return { success: true, id: createdUser.id, tempPassword };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const session = await requireAdmin();

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { status: true, email: true, role: true },
  });
  if (!existingUser) {
    return { error: "User not found" };
  }

  if (!canManageUser(session.user.role, existingUser.role)) {
    return { error: "Only a Super Admin can manage Admin or Super Admin accounts." };
  }

  const { password, ...rest } = parsed.data;

  if (rest.role !== existingUser.role && !canAssignRole(session.user.role, rest.role)) {
    return { error: "Only a Super Admin can assign Admin or Super Admin roles." };
  }

  const updateData: Record<string, unknown> = {
    ...rest,
    middleName: rest.middleName || null,
    phoneNumber: rest.phoneNumber || null,
    idNumber: rest.idNumber || null,
    department: rest.department || null,
    course: rest.course || null,
    yearLevel: rest.yearLevel || null,
    section: rest.section || null,
    academicYear: rest.academicYear || null,
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

/**
 * Bulk, reversible graduation — the Student Farmer counterpart to
 * harvestPlot/unharvestPlot. Graduation is orthogonal to `status`; this
 * never touches status and never cascades (growth logs, plot assignments,
 * alerts all stay intact).
 *
 * All-or-nothing: any id that isn't a not-yet-graduated STUDENT_FARMER
 * rejects the whole batch, rather than silently applying to a subset. In
 * practice this should rarely trigger — the "Mark as graduated" dialog's
 * candidate list is already built from a pre-filtered, non-graduated
 * student query.
 */
export async function graduateStudents(userIds: string[], graduatedAt: Date) {
  await requireAdmin();

  if (userIds.length === 0) {
    return { error: "No students selected" };
  }

  const matched = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, graduatedAt: true },
  });

  if (matched.length !== userIds.length) {
    return { error: "One or more selected users could not be found." };
  }
  if (matched.some((u) => u.role !== "STUDENT_FARMER")) {
    return { error: "Only student farmers can be marked as graduated." };
  }
  if (matched.some((u) => u.graduatedAt)) {
    return { error: "One or more selected students are already graduated." };
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      graduatedAt,
      // Belt-and-suspenders: graduatedAt itself is already checked at every
      // revocation checkpoint (auth.ts / mobile-auth.ts), but bumping this
      // too matches the existing "state change that should kill sessions"
      // convention used for deactivation/password changes.
      tokenVersion: { increment: 1 },
    },
  });

  revalidatePath("/dashboard/users");
  return { success: true, count: userIds.length };
}

/**
 * Reversible: clears graduatedAt so the account regains access. Mirrors
 * unharvestPlot — no cascading changes, historical data untouched.
 */
export async function ungraduateStudents(userIds: string[]) {
  await requireAdmin();

  if (userIds.length === 0) {
    return { error: "No students selected" };
  }

  const matched = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, graduatedAt: true },
  });

  if (matched.length !== userIds.length) {
    return { error: "One or more selected users could not be found." };
  }
  if (matched.some((u) => u.role !== "STUDENT_FARMER")) {
    return { error: "Only student farmers can be un-graduated." };
  }
  if (matched.some((u) => !u.graduatedAt)) {
    return { error: "One or more selected students are not graduated." };
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { graduatedAt: null },
  });

  revalidatePath("/dashboard/users");
  return { success: true, count: userIds.length };
}