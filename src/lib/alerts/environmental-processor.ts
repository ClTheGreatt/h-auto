import type {
  AlertType,
  CropStage,
  PlotStatus,
  SensorReading,
} from "@prisma/client";
import { isOperationalPlotStatus } from "@/lib/plots/lifecycle";
import {
  evaluateCurrentReading,
  type Violation,
} from "./threshold-checker";
import { buildAlertSuggestion, type AlertSuggestion } from "./suggestions";

export type EnvironmentalReadingRecord = SensorReading & {
  plot: {
    name: string;
    status: PlotStatus;
    currentStage: CropStage | null;
  };
};

type PersistViolationInput = {
  reading: EnvironmentalReadingRecord;
  violation: Violation;
  suggestion: AlertSuggestion | null;
};

type NotifyNewAlertInput = PersistViolationInput & {
  alert: { id: string };
};

export type EnvironmentalProcessorDependencies = {
  persistViolation(input: PersistViolationInput): Promise<{
    alert: { id: string };
    created: boolean;
  }>;
  findOpenAlerts(plotId: string): Promise<Array<{ id: string; type: AlertType }>>;
  resolveAlert(alertId: string, resolvedAt: Date): Promise<void>;
  notifyNewAlert(input: NotifyNewAlertInput): Promise<void>;
  logNotificationFailure(input: {
    alertId: string;
    plotId: string;
    error: unknown;
  }): void;
};

export type EnvironmentalProcessingResult = {
  evaluatedSensorCount: number;
  violationCount: number;
  createdAlertCount: number;
  resolvedAlertCount: number;
  notificationFailureCount: number;
};

/**
 * Persist the complete environmental incident state before attempting any
 * best-effort notification delivery. This keeps SMS/email/push/in-app
 * delivery failures from blocking later violations or recovery resolution.
 */
export async function processEnvironmentalReading(
  reading: EnvironmentalReadingRecord,
  dependencies: EnvironmentalProcessorDependencies
): Promise<EnvironmentalProcessingResult> {
  if (!isOperationalPlotStatus(reading.plot.status) || !reading.plot.currentStage) {
    return {
      evaluatedSensorCount: 0,
      violationCount: 0,
      createdAlertCount: 0,
      resolvedAlertCount: 0,
      notificationFailureCount: 0,
    };
  }

  const evaluation = evaluateCurrentReading(
    reading,
    reading.plot.currentStage,
    reading.recordedAt
  );
  const pendingNotifications: NotifyNewAlertInput[] = [];

  for (const violation of evaluation.violations) {
    let suggestion: AlertSuggestion | null = null;
    try {
      suggestion = buildAlertSuggestion({
        type: violation.type,
        currentValue: violation.value,
        threshold: violation.type.startsWith("LOW_")
          ? violation.min
          : violation.max,
      });
    } catch (err) {
      console.warn("[processSensorReading] suggestion builder failed:", err);
    }

    const { alert, created } = await dependencies.persistViolation({
      reading,
      violation,
      suggestion,
    });
    if (created) {
      pendingNotifications.push({
        alert,
        reading,
        violation,
        suggestion,
      });
    }
  }

  const activeAlerts = await dependencies.findOpenAlerts(reading.plotId);
  const stillViolatingTypes = new Set<AlertType>(
    evaluation.violations.map((violation) => violation.type)
  );
  const resolvedAt = new Date();
  let resolvedAlertCount = 0;
  for (const alert of activeAlerts) {
    if (
      evaluation.evaluatedAlertTypes.has(
        alert.type as Exclude<AlertType, "DEVICE_OFFLINE">
      ) &&
      !stillViolatingTypes.has(alert.type)
    ) {
      await dependencies.resolveAlert(alert.id, resolvedAt);
      resolvedAlertCount++;
    }
  }

  let notificationFailureCount = 0;
  for (const notification of pendingNotifications) {
    try {
      await dependencies.notifyNewAlert(notification);
    } catch (error) {
      notificationFailureCount++;
      dependencies.logNotificationFailure({
        alertId: notification.alert.id,
        plotId: reading.plotId,
        error,
      });
    }
  }

  return {
    evaluatedSensorCount: evaluation.evaluatedSensorCount,
    violationCount: evaluation.violations.length,
    createdAlertCount: pendingNotifications.length,
    resolvedAlertCount,
    notificationFailureCount,
  };
}
