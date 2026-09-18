"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { plotSchema, type PlotFormValues } from "@/lib/validations/plot";
import { FORM_EDITABLE_PLOT_STATUSES } from "@/lib/plots/lifecycle";
import { applyPlotTransitionEffects } from "@/lib/plots/transition-effects";
import {
  applyPlotUpdateWithAdviserIntegrity,
  runPlotAdviserTransaction,
  validateNewPlotAdviser,
} from "@/lib/plots/adviser-integrity";

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
  const proposedFacultyId = data.facultyId || null;
  const result = await runPlotAdviserTransaction(async (tx) => {
    const adviserValidation = await validateNewPlotAdviser(
      proposedFacultyId,
      tx
    );
    if (!adviserValidation.ok) return adviserValidation;

    const created = await tx.plot.create({
      data: {
        name: data.name,
        location: data.location || null,
        sizeSqm: data.sizeSqm ?? null,
        cropId: data.cropId || null,
        facultyId: proposedFacultyId,
        currentStageId: data.currentStageId || null,
        plantingDate: parseDate(data.plantingDate),
        expectedHarvest: parseDate(data.expectedHarvest),
        status: data.status,
      },
    });
    return { ok: true as const, created };
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard/plots");
  return { success: true, id: result.created.id };
}

export async function updatePlot(id: string, input: PlotFormValues) {
  await requireAdmin();
  const parsed = plotSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const data = parsed.data;

  const existing = await prisma.plot.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) return { error: "Plot not found" };

  // HARVESTED/ARCHIVED are locked out of this generic save — each has its
  // own dedicated, confirmed action (harvestPlot/archivePlot) that also
  // writes a companion timestamp (harvestedAt/archivedAt) this form doesn't
  // know about. If the plot is already locked, its status is left exactly
  // as-is no matter what the form submitted: defaultValues seeds the form
  // with the current status so a normal save round-trips it unchanged, and
  // a request that claims otherwise is treated as tampered, not honored.
  const statusIsLocked = !FORM_EDITABLE_PLOT_STATUSES.includes(existing.status);
  let nextStatus = existing.status;
  if (!statusIsLocked) {
    if (!FORM_EDITABLE_PLOT_STATUSES.includes(data.status)) {
      return {
        error: "Use the dedicated Harvest or Archive action to set that status.",
      };
    }
    nextStatus = data.status;
  }

  const transitionedAt = new Date();
  const proposedFacultyId = data.facultyId || null;
  const result = await runPlotAdviserTransaction(async (tx) => {
    return applyPlotUpdateWithAdviserIntegrity(
      { plotId: id, proposedFacultyId },
      tx,
      async () => {
        const effects = await applyPlotTransitionEffects({
          client: tx,
          plotId: id,
          previousStatus: existing.status,
          nextStatus,
          transitionedAt,
        });
        await tx.plot.update({
          where: { id },
          data: {
            name: data.name,
            location: data.location || null,
            sizeSqm: data.sizeSqm ?? null,
            cropId: data.cropId || null,
            facultyId: proposedFacultyId,
            currentStageId: data.currentStageId || null,
            plantingDate: parseDate(data.plantingDate),
            expectedHarvest: parseDate(data.expectedHarvest),
            status: nextStatus,
          },
        });
        return effects;
      }
    );
  });
  if (!result.ok) return { error: result.error };
  const transitionEffects = result.value;

  revalidatePath("/dashboard/plots");
  revalidatePath(`/dashboard/plots/${id}`);
  if (transitionEffects.completedAssignments) {
    revalidatePath("/dashboard/assignments");
  }
  if (transitionEffects.closedOpenAlerts) {
    revalidatePath("/dashboard/alerts");
  }
  return { success: true };
}

// Soft delete: archives the plot instead of a hard `delete`, so historical
// sensor readings, growth logs (with photos), and alerts are preserved
// rather than cascade-deleted. Any active assignments are ended as part of
// the same transaction (matching removeAssignment's own field writes)
// rather than blocking the admin from archiving until they're removed one
// by one. restorePlot does not reverse this — a restored plot comes back
// with no active assignments and they must be re-assigned.
export async function archivePlot(id: string) {
  await requireAdmin();

  const plot = await prisma.plot.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!plot) return { error: "Plot not found" };
  if (plot.status === "ARCHIVED") return { error: "Plot is already archived." };

  const transitionedAt = new Date();
  const transitionEffects = await prisma.$transaction(async (tx) => {
    const effects = await applyPlotTransitionEffects({
      client: tx,
      plotId: id,
      previousStatus: plot.status,
      nextStatus: "ARCHIVED",
      transitionedAt,
    });
    await tx.plot.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: transitionedAt },
    });
    return effects;
  });

  revalidatePath("/dashboard/plots");
  revalidatePath("/dashboard/plots/archived");
  revalidatePath("/dashboard/assignments");
  revalidatePath(`/dashboard/plots/${id}`);
  if (transitionEffects.closedOpenAlerts) {
    revalidatePath("/dashboard/alerts");
  }
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

  const transitionedAt = new Date();
  const transitionEffects = await prisma.$transaction(async (tx) => {
    const effects = await applyPlotTransitionEffects({
      client: tx,
      plotId: id,
      previousStatus: plot.status,
      nextStatus: "HARVESTED",
      transitionedAt,
    });
    await tx.plot.update({
      where: { id },
      data: { status: "HARVESTED", harvestedAt: transitionedAt },
    });
    return effects;
  });

  revalidatePath("/dashboard/plots");
  revalidatePath("/dashboard/plots/archived");
  revalidatePath(`/dashboard/plots/${id}`);
  if (transitionEffects.completedAssignments) {
    revalidatePath("/dashboard/assignments");
  }
  if (transitionEffects.closedOpenAlerts) {
    revalidatePath("/dashboard/alerts");
  }
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
