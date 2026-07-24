"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { cropSchema, type CropFormValues } from "@/lib/validations/crop";

export async function createCrop(input: CropFormValues) {
  await requireAdmin();

  const parsed = cropSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const existing = await prisma.crop.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) return { error: "A crop with this name already exists" };

  const { stages, ...cropData } = parsed.data;

  await prisma.crop.create({
    data: {
      ...cropData,
      variety: cropData.variety || null,
      description: cropData.description || null,
      cultivationGuide: cropData.cultivationGuide || null,
      stages: {
        create: stages.map((s, i) => ({
          ...s,
          orderIndex: i,
          description: s.description || null,
        })),
      },
    },
  });

  revalidatePath("/dashboard/crops");
  return { success: true };
}

export async function updateCrop(id: string, input: CropFormValues) {
  await requireAdmin();

  const parsed = cropSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const existing = await prisma.crop.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (existing) return { error: "A crop with this name already exists" };

  const { stages, ...cropData } = parsed.data;

  await prisma.$transaction([
    prisma.cropStage.deleteMany({ where: { cropId: id } }),
    prisma.crop.update({
      where: { id },
      data: {
        ...cropData,
        variety: cropData.variety || null,
        description: cropData.description || null,
        cultivationGuide: cropData.cultivationGuide || null,
        stages: {
          create: stages.map((s, i) => ({
            ...s,
            orderIndex: i,
            description: s.description || null,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/dashboard/crops");
  revalidatePath(`/dashboard/crops/${id}/edit`);
  return { success: true };
}

// Soft delete: archives the crop instead of a hard `delete`, so historical
// crop data (and any plot that already references it) is preserved rather
// than blocked or cascade-deleted. Plots keep their existing crop reference
// even after it's archived — only new assignments are prevented (enforced
// by the crop pickers on the plot create/edit forms, not here).
export async function archiveCrop(id: string) {
  await requireAdmin();

  const crop = await prisma.crop.findUnique({ where: { id } });
  if (!crop) return { error: "Crop not found" };
  if (crop.status === "ARCHIVED") {
    return { error: "Crop is already archived" };
  }

  await prisma.crop.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  revalidatePath("/dashboard/crops");
  revalidatePath("/dashboard/crops/archived");
  return { success: true };
}

// Promotes/demotes a crop in the Add-crop Quick start dropdown's "Custom"
// group. Same role gate as every other crop-management action (requireAdmin
// already encodes "SUPER_ADMIN or ADMIN only" — no separate role check to
// hand-roll here, unlike canAssignRole/canManageUser which compare against a
// *different user's* role; there's no such comparison for a crop flag).
export async function togglePreset(id: string, value: boolean) {
  await requireAdmin();

  const crop = await prisma.crop.findUnique({ where: { id } });
  if (!crop) return { error: "Crop not found" };

  await prisma.crop.update({
    where: { id },
    data: { isPreset: value },
  });

  revalidatePath("/dashboard/crops");
  revalidatePath(`/dashboard/crops/${id}/edit`);
  revalidatePath("/dashboard/crops/new");
  return { success: true };
}

export async function restoreCrop(id: string) {
  await requireAdmin();

  const crop = await prisma.crop.findUnique({ where: { id } });
  if (!crop) return { error: "Crop not found" };
  if (crop.status !== "ARCHIVED") {
    return { error: "Crop is not archived" };
  }

  await prisma.crop.update({
    where: { id },
    data: { status: "ACTIVE", archivedAt: null },
  });

  revalidatePath("/dashboard/crops");
  revalidatePath("/dashboard/crops/archived");
  return { success: true };
}