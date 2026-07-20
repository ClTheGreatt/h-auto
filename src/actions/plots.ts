"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { plotSchema, type PlotFormValues } from "@/lib/validations/plot";

function parseDate(v: string | undefined | null): Date | null {
  if (!v || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function createPlot(input: PlotFormValues) {
  await requireAdmin();
  const parsed = plotSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const data = parsed.data;
  const created = await prisma.plot.create({
    data: {
      name: data.name,
      location: data.location || null,
      sizeSqm: data.sizeSqm ?? null,
      cropId: data.cropId || null,
      facultyId: data.facultyId || null,
      currentStageId: data.currentStageId || null,
      plantingDate: parseDate(data.plantingDate),
      expectedHarvest: parseDate(data.expectedHarvest),
      status: data.status,
    },
  });

  revalidatePath("/dashboard/plots");
  return { success: true, id: created.id };
}

export async function updatePlot(id: string, input: PlotFormValues) {
  await requireAdmin();
  const parsed = plotSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const data = parsed.data;
  await prisma.plot.update({
    where: { id },
    data: {
      name: data.name,
      location: data.location || null,
      sizeSqm: data.sizeSqm ?? null,
      cropId: data.cropId || null,
      facultyId: data.facultyId || null,
      currentStageId: data.currentStageId || null,
      plantingDate: parseDate(data.plantingDate),
      expectedHarvest: parseDate(data.expectedHarvest),
      status: data.status,
    },
  });

  revalidatePath("/dashboard/plots");
  revalidatePath(`/dashboard/plots/${id}`);
  return { success: true };
}

// Soft delete: archives the plot instead of a hard `delete`, so historical
// sensor readings, growth logs (with photos), and alerts are preserved
// rather than cascade-deleted.
export async function archivePlot(id: string) {
  await requireAdmin();

  const assignmentCount = await prisma.plotAssignment.count({
    where: { plotId: id, status: "ACTIVE" },
  });
  if (assignmentCount > 0) {
    return { error: `Cannot archive: ${assignmentCount} active assignment(s) exist. End them first.` };
  }

  await prisma.plot.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  revalidatePath("/dashboard/plots");
  revalidatePath("/dashboard/plots/archived");
  return { success: true };
}

// Admin/Super Admin only (requireAdmin) — Faculty cannot restore. Restores
// to PREPARING as a safe re-entry state; the admin can transition it to
// whatever status actually applies via the edit form afterward.
export async function restorePlot(id: string) {
  await requireAdmin();

  const plot = await prisma.plot.findUnique({ where: { id } });
  if (!plot) return { error: "Plot not found" };
  if (plot.status !== "ARCHIVED") {
    return { error: "Plot is not archived" };
  }

  await prisma.plot.update({
    where: { id },
    data: { status: "PREPARING", archivedAt: null },
  });

  revalidatePath("/dashboard/plots");
  revalidatePath("/dashboard/plots/archived");
  revalidatePath(`/dashboard/plots/${id}`);
  return { success: true };
}

export async function harvestPlot(id: string) {
  await requireAdmin();

  const plot = await prisma.plot.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!plot) return { error: "Plot not found" };
  if (plot.status === "HARVESTED") {
    return { error: "Plot is already harvested." };
  }
  if (plot.status === "ARCHIVED") {
    return { error: "Cannot harvest an archived plot." };
  }

  await prisma.plot.update({
    where: { id },
    data: { status: "HARVESTED", harvestedAt: new Date() },
  });

  revalidatePath("/dashboard/plots");
  revalidatePath("/dashboard/plots/archived");
  revalidatePath(`/dashboard/plots/${id}`);
  return { success: true };
}

export async function unharvestPlot(id: string) {
  await requireAdmin();

  const plot = await prisma.plot.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!plot) return { error: "Plot not found" };
  if (plot.status !== "HARVESTED") {
    return { error: "Plot is not harvested." };
  }

  await prisma.plot.update({
    where: { id },
    data: { status: "GROWING", harvestedAt: null },
  });

  revalidatePath("/dashboard/plots");
  revalidatePath("/dashboard/plots/archived");
  revalidatePath(`/dashboard/plots/${id}`);
  return { success: true };
}