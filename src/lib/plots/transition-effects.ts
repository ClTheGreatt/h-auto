import type { PlotStatus } from "@prisma/client";
import {
  isHistoricalPlotStatus,
  isOperationalPlotStatus,
} from "./lifecycle";

type UpdateManyResult = PromiseLike<{ count: number }>;

export type PlotTransitionEffectsClient = {
  plotAssignment: {
    updateMany(args: {
      where: { plotId: string; status: "ACTIVE" };
      data: { status: "COMPLETED"; endedAt: Date };
    }): UpdateManyResult;
  };
  alert: {
    updateMany(args: {
      where: { plotId: string; resolved: false };
      data: { resolved: true; resolvedAt: Date };
    }): UpdateManyResult;
  };
};

export type PlotTransitionEffects = {
  completedAssignments: boolean;
  closedOpenAlerts: boolean;
};

export async function applyPlotTransitionEffects({
  client,
  plotId,
  previousStatus,
  nextStatus,
  transitionedAt,
}: {
  client: PlotTransitionEffectsClient;
  plotId: string;
  previousStatus: PlotStatus;
  nextStatus: PlotStatus;
  transitionedAt: Date;
}): Promise<PlotTransitionEffects> {
  const statusChanged = previousStatus !== nextStatus;
  const completedAssignments =
    statusChanged && isHistoricalPlotStatus(nextStatus);
  const closedOpenAlerts =
    statusChanged &&
    isOperationalPlotStatus(previousStatus) &&
    !isOperationalPlotStatus(nextStatus);

  if (completedAssignments) {
    await client.plotAssignment.updateMany({
      where: { plotId, status: "ACTIVE" },
      data: { status: "COMPLETED", endedAt: transitionedAt },
    });
  }

  if (closedOpenAlerts) {
    await client.alert.updateMany({
      where: { plotId, resolved: false },
      data: { resolved: true, resolvedAt: transitionedAt },
    });
  }

  return { completedAssignments, closedOpenAlerts };
}
