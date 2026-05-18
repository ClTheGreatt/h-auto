"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/lib/validations/profile";

export async function updateProfile(input: UpdateProfileInput) {
  const session = await requireAuth();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName: parsed.data.firstName,
        middleName: parsed.data.middleName || null,
        lastName: parsed.data.lastName,
        phoneNumber: parsed.data.phoneNumber || null,
      },
    });
  } catch (error) {
    console.error("updateProfile error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        error: "That phone number is already used by another account.",
        fieldErrors: {
          phoneNumber: ["That phone number is already used by another account."],
        },
      };
    }

    return { error: "Failed to update profile. Please try again." };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function changePassword(input: ChangePasswordInput) {
  const session = await requireAuth();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Verify current password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) {
    return { error: "User not found" };
  }

  const isCurrentValid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );

  if (!isCurrentValid) {
    return {
      error: "Current password is incorrect",
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    };
  }

  // Hash and save new password
  try {
    const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return { error: "Failed to change password. Please try again." };
  }

  return { success: true };
}
