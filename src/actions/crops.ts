"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { cropSchema, type CropFormValues } from "@/lib/validations/crop";

// The CropStage columns a form submission can actually write — explicitly
// listed (not spread) so a submitted `dbId` can never reach Prisma as a
// column. orderIndex is always assigned separately from array position.
function toStageData(s: CropFormValues["stages"][number]) {
  return {
    name: s.name,
    durationDays: s.durationDays,
    description: s.description || null,
    minSoilMoisture: s.minSoilMoisture,
    maxSoilMoisture: s.maxSoilMoisture,
    minTemperature: s.minTemperature,
    maxTemperature: s.maxTemperature,
    minHumidity: s.minHumidity,
    maxHumidity: s.maxHumidity,
    minLightIntensity: s.minLightIntensity,
    maxLightIntensity: s.maxLightIntensity,
    minNitrogen: s.minNitrogen,
    maxNitrogen: s.maxNitrogen,
    minPhosphorus: s.minPhosphorus,
    maxPhosphorus: s.maxPhosphorus,
    minPotassium: s.minPotassium,
    maxPotassium: s.maxPotassium,
  };
}

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

  // A brand-new crop has no existing rows to match against — any submitted
  // dbId (CropForm never sets one in create mode) is ignored regardless,
  // since toStageData() never reads it.
  await prisma.crop.create({
    data: {
      ...cropData,
      variety: cropData.variety || null,
      description: cropData.description || null,
      cultivationGuide: cropData.cultivationGuide || null,
      stages: {
        create: stages.map((s, i) => ({
          ...toStageData(s),
          orderIndex: i,
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

  const currentStages = await prisma.cropStage.findMany({
    where: { cropId: id },
    select: { id: true, name: true },
  });
  const currentStageIds = new Set(currentStages.map((s) => s.id));

  // SECURITY: a submitted dbId must actually belong to this crop. Without
  // this, an admin could submit a stage id copied from a different crop and
  // have updateCrop silently rewrite that other crop's stage in place.
  for (const s of stages) {
    if (s.dbId && !currentStageIds.has(s.dbId)) {
      return { error: "One or more submitted stages do not belong to this crop." };
    }
  }

  const submittedIds = new Set(
    stages.filter((s): s is typeof s & { dbId: string } => Boolean(s.dbId)).map((s) => s.dbId)
  );
  const removedStages = currentStages.filter((s) => !submittedIds.has(s.id));

  // STEP 3: block removing a stage that a plot is still actively on, rather
  // than silently nulling Plot.currentStageId out from under it. GrowthLog
  // is deliberately not checked here — historical logs referencing a
  // removed stage are acceptable collateral, and blocking on them would
  // make a stage undeletable forever the moment it's ever been logged
  // against once.
  if (removedStages.length > 0) {
    const affectedPlots = await prisma.plot.findMany({
      where: { currentStageId: { in: removedStages.map((s) => s.id) } },
      select: { name: true, currentStageId: true },
    });
    if (affectedPlots.length > 0) {
      const stageNameById = new Map(removedStages.map((s) => [s.id, s.name]));
      const plotsByStage = new Map<string, string[]>();
      for (const plot of affectedPlots) {
        const stageName = stageNameById.get(plot.currentStageId!) ?? "a removed stage";
        plotsByStage.set(stageName, [
          ...(plotsByStage.get(stageName) ?? []),
          plot.name,
        ]);
      }
      const parts = Array.from(plotsByStage.entries()).map(
        ([stageName, plotNames]) => `"${stageName}" (in use by ${plotNames.join(", ")})`
      );
      return {
        error: `Cannot remove stage ${parts.join("; ")}. Change the affected plot's stage first, then save again.`,
      };
    }
  }

  // Nothing is written until this point — the checks above run entirely
  // before the transaction opens, so a blocked save leaves the DB untouched.
  await prisma.$transaction(async (tx) => {
    if (removedStages.length > 0) {
      await tx.cropStage.deleteMany({
        where: { id: { in: removedStages.map((s) => s.id) } },
      });
    }

    // Existing stages can only ever move to an equal-or-lower orderIndex
    // here (CropForm's useFieldArray only supports append-at-end and
    // remove — no reorder control), and removed stages are deleted above
    // before this loop runs. Processing in ascending target-index order
    // means every slot a still-live stage needs is already vacated by the
    // time we reach it, so this never collides with
    // @@unique([cropId, orderIndex]) — no two-pass write required.
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.dbId) {
        await tx.cropStage.update({
          where: { id: s.dbId },
          data: { ...toStageData(s), orderIndex: i },
        });
      } else {
        await tx.cropStage.create({
          data: { ...toStageData(s), orderIndex: i, cropId: id },
        });
      }
    }

    await tx.crop.update({
      where: { id },
      data: {
        ...cropData,
        variety: cropData.variety || null,
        description: cropData.description || null,
        cultivationGuide: cropData.cultivationGuide || null,
      },
    });
  });

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