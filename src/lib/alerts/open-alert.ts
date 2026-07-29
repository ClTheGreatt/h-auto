import "server-only";

import { Prisma, type Alert, type AlertType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type OpenAlertCreateData = Omit<
  Prisma.AlertUncheckedCreateInput,
  | "id"
  | "plotId"
  | "type"
  | "resolved"
  | "resolvedAt"
  | "createdAt"
  | "notifications"
>;

export type OpenAlertCreateResult = {
  alert: Alert;
  created: boolean;
};

export async function createOpenAlertIfAbsent({
  plotId,
  type,
  data,
}: {
  plotId: string;
  type: AlertType;
  data: OpenAlertCreateData;
}): Promise<OpenAlertCreateResult> {
  const existing = await prisma.alert.findFirst({
    where: { plotId, type, resolved: false },
  });
  if (existing) {
    return { alert: existing, created: false };
  }

  try {
    const alert = await prisma.alert.create({
      data: {
        ...data,
        plotId,
        type,
        resolved: false,
      },
    });
    return { alert, created: true };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const winner = await prisma.alert.findFirst({
      where: { plotId, type, resolved: false },
    });
    if (!winner) {
      throw error;
    }

    return { alert: winner, created: false };
  }
}
