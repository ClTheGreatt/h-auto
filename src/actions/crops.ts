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

export async function deleteCrop(id: string) {
  await requireAdmin();

  const plotCount = await prisma.plot.count({ where: { cropId: id } });
  if (plotCount > 0) {
    return {
      error: `Cannot delete: ${plotCount} plot(s) are using this crop. Reassign them first.`,
    };
  }

  await prisma.crop.delete({ where: { id } });
  revalidatePath("/dashboard/crops");
  return { success: true };
}