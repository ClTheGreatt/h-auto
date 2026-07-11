"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFaculty } from "@/lib/auth-helpers";

export async function resolveAlert(id: string) {
  await requireFaculty();

  await prisma.alert.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date() },
  });

  revalidatePath("/dashboard/alerts");
  return { success: true };
}