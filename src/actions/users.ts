"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user";

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

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const { password: _password, ...rest } = parsed.data;
  void _password;

  try {
    await prisma.user.create({
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
      },
    });
  } catch (error) {
    const friendly = handlePrismaError(error);
    if (friendly) return friendly;
    console.error("createUser error:", error);
    return { error: "Failed to create user. Please try again." };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
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

  if (password && password.length > 0) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
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

export async function deleteUser(id: string) {
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
        await prisma.user.update({
          where: { id },
          data: { status: "INACTIVE" },
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

    console.error("deleteUser error:", error);
    return {
      error:
        "Failed to delete user. Please contact your administrator if this persists.",
    };
  }
}