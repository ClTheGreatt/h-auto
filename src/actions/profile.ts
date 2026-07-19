"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
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

  // Hash and save new password. Bumping tokenVersion invalidates any
  // existing session/token for this account (including this one, on its
  // next request) — the auth.ts jwt callback rejects a stale tokenVersion.
  try {
    const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return { error: "Failed to change password. Please try again." };
  }

  return { success: true };
}

export async function updateProfileImage(formData: FormData) {
  const session = await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No image selected." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Please choose an image file." };
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_BYTES) {
    return { error: "Image is too large. Maximum size is 5MB." };
  }

  const upload = await uploadImageToCloudinary(file, "h-auto/avatars");
  if (!upload.success || !upload.url) {
    return { error: upload.error ?? "Upload failed. Please try again." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { profileImage: upload.url },
    });
  } catch (error) {
    console.error("updateProfileImage error:", error);
    return { error: "Failed to save your photo. Please try again." };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { success: true, url: upload.url };
}