"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";
import { assertCanAccessPlot } from "@/lib/auth/plot-access";

export async function resolveAlert(id: string) {
  const session = await requireFaculty();

  const alert = await prisma.alert.findUnique({
    where: { id },
    select: { plotId: true },
  });
  if (!alert) return { error: "Alert not found" };

  const hasAccess = await assertCanAccessPlot(
    session.user.role,
    session.user.id,
    alert.plotId
  );
  if (!hasAccess) {
    return { error: "You don't have access to this alert's plot." };
  }

  await prisma.alert.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date() },
  });

  revalidatePath("/dashboard/alerts");
  return { success: true };
}