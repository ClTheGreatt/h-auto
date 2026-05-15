"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/auth-helpers";
import { growthLogSchema, type GrowthLogFormValues } from "@/lib/validations/growth";

async function canAccessPlot(plotId: string, userId: string, role: string) {
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "FACULTY") {
    return true;
  }
  const assignment = await prisma.plotAssignment.findFirst({
    where: { plotId, studentId: userId, status: "ACTIVE" },
  });
  return !!assignment;
}

export async function createGrowthLog(plotId: string, input: GrowthLogFormValues) {
  const session = await requireAuth();
  const userId = session.user.id;
  const role = session.user.role;

  const allowed = await canAccessPlot(plotId, userId, role);
  if (!allowed) return { error: "You don't have access to this plot" };

  const parsed = growthLogSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  await prisma.growthLog.create({
    data: {
      plotId,
      userId,
      stageId: parsed.data.stageId || null,
      plantHeightCm: parsed.data.plantHeightCm ?? null,
      leafCount: parsed.data.leafCount ?? null,
      observations: parsed.data.observations || null,
      notes: parsed.data.notes || null,
      images: {
        create: parsed.data.images.map((url) => ({ imageUrl: url })),
      },
    },
  });

  revalidatePath(`/dashboard/plots/${plotId}`);
  revalidatePath("/dashboard/monitoring");
  return { success: true };
}

export async function deleteGrowthLog(id: string) {
  const session = await requireAuth();

  const log = await prisma.growthLog.findUnique({ where: { id } });
  if (!log) return { error: "Log not found" };

  // Only the author or admin can delete
  const isAuthor = log.userId === session.user.id;
  const isAdmin =
    session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";

  if (!isAuthor && !isAdmin) {
    return { error: "You don't have permission to delete this log" };
  }

  await prisma.growthLog.delete({ where: { id } });
  revalidatePath(`/dashboard/plots/${log.plotId}`);
  revalidatePath("/dashboard/monitoring");
  return { success: true };
}