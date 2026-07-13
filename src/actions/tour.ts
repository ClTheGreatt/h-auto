"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function markTourCompletedAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, error: "Not authenticated" };
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { tourCompletedAt: new Date() },
    });
    return { ok: true };
  } catch (err) {
    console.error("[markTourCompletedAction]", err);
    return { ok: false, error: "Failed to update tour status" };
  }
}

export async function resetTourAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, error: "Not authenticated" };
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { tourCompletedAt: null },
    });
    return { ok: true };
  } catch (err) {
    console.error("[resetTourAction]", err);
    return { ok: false, error: "Failed to reset tour" };
  }
}
