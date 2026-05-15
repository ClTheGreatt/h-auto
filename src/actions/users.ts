"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user";

export async function createUser(input: CreateUserInput) {
  await requireAdmin();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "Email already in use" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const { password: _password, ...rest } = parsed.data;
  void _password;

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

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await requireAdmin();

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id } },
  });
  if (existing) return { error: "Email already in use" };

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

  await prisma.user.update({ where: { id }, data: updateData });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    return { error: "You cannot delete your own account" };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/dashboard/users");
  return { success: true };
}