import "server-only";

import {
  Prisma,
  type Alert,
  type AlertSeverity,
  type AlertType,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ThresholdAlertType } from "./threshold-checker";

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

export type RefreshOpenThresholdAlertResult = {
  updated: boolean;
};

export type OpenAlertPrismaClient = Pick<PrismaClient, "alert">;

export async function createOpenAlertIfAbsent({
  plotId,
  type,
  data,
  client = prisma,
}: {
  plotId: string;
  type: AlertType;
  data: OpenAlertCreateData;
  client?: OpenAlertPrismaClient;
}): Promise<OpenAlertCreateResult> {
  const existing = await client.alert.findFirst({
    where: { plotId, type, resolved: false },
  });
  if (existing) {
    return { alert: existing, created: false };
  }

  try {
    const alert = await client.alert.create({
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

    const winner = await client.alert.findFirst({
      where: { plotId, type, resolved: false },
    });
    if (!winner) {
      throw error;
    }

    return { alert: winner, created: false };
  }
}

export async function refreshOpenThresholdAlert({
  alertId,
  plotId,
  type,
  incomingReadingId,
  incomingRecordedAt,
  severity,
  message,
  suggestionTitle,
  suggestionSteps,
}: {
  alertId: string;
  plotId: string;
  type: ThresholdAlertType;
  incomingReadingId: string;
  incomingRecordedAt: Date;
  severity: AlertSeverity;
  message: string;
  suggestionTitle: string | null;
  suggestionSteps: string[];
}): Promise<RefreshOpenThresholdAlertResult> {
  const result = await prisma.alert.updateMany({
    where: {
      id: alertId,
      plotId,
      type,
      resolved: false,
      OR: [
        { readingId: null },
        {
          reading: {
            is: {
              recordedAt: { lte: incomingRecordedAt },
            },
          },
        },
      ],
    },
    data: {
      readingId: incomingReadingId,
      severity,
      message,
      suggestionTitle,
      suggestionSteps,
    },
  });

  return { updated: result.count === 1 };
}
