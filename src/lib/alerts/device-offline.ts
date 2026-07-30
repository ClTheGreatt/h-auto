import type {
  AlertSeverity,
  DeviceStatus,
  PlotStatus,
} from "@prisma/client";
import {
  ACTIVE_MONITORING_PLOT_STATUSES,
  DEVICE_OFFLINE_THRESHOLD_MS,
} from "@/lib/utils/device-status";
import type { AlertSuggestion } from "./suggestions";

export const CRITICAL_OFFLINE_THRESHOLD_MS = 120 * 60 * 1000;

const EXCLUDED_DEVICE_STATUSES: DeviceStatus[] = ["MAINTENANCE", "RETIRED"];
const OPERATIONAL_PLOT_STATUSES: PlotStatus[] = [
  ...ACTIVE_MONITORING_PLOT_STATUSES,
];

export type OfflineDeviceCandidate = {
  id: string;
  deviceCode: string;
  plotId: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  plot: {
    name: string;
    status: PlotStatus;
  };
};

export type OfflineAlertRecord = {
  id: string;
  plotId: string;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  suggestionTitle: string | null;
  suggestionSteps: string[];
};

export type OfflinePolicyDecision = {
  eligible: boolean;
  elapsedMs: number | null;
  severity: AlertSeverity | null;
};

export type OfflineScanSummary = {
  scanned: number;
  markedOffline: number;
  createdAlerts: number;
  existingAlerts: number;
  escalatedAlerts: number;
  notificationAttempts: number;
  skippedConcurrentRecovery: number;
  skippedUnconfirmedRecovery: number;
  failures: number;
};

type CreateOfflineAlertInput = {
  plotId: string;
  severity: AlertSeverity;
  message: string;
  suggestion: AlertSuggestion | null;
};

type RefreshOfflineAlertInput = CreateOfflineAlertInput & {
  alertId: string;
};

type SendOfflineNotificationInput = {
  alert: { id: string };
  device: OfflineDeviceCandidate;
  severity: AlertSeverity;
  message: string;
  suggestion: AlertSuggestion | null;
};

export type DeviceOfflineIncidentTransaction = {
  markOfflineIfStillEligible(input: {
    deviceId: string;
    cutoff: Date;
  }): Promise<number>;
  findOpenAlert(plotId: string): Promise<OfflineAlertRecord | null>;
  findLatestResolvedAlert(
    plotId: string
  ): Promise<{ resolvedAt: Date | null } | null>;
  createOpenAlert(input: CreateOfflineAlertInput): Promise<{
    alert: OfflineAlertRecord;
    created: boolean;
  }>;
  refreshOpenAlert(input: RefreshOfflineAlertInput): Promise<number>;
};

export type DeviceOfflineScanDependencies = {
  findEligibleDevices(cutoff: Date): Promise<OfflineDeviceCandidate[]>;
  runInTransaction<T>(
    operation: (transaction: DeviceOfflineIncidentTransaction) => Promise<T>
  ): Promise<T>;
  buildSuggestion(): AlertSuggestion | null;
  sendNotifications(input: SendOfflineNotificationInput): Promise<void>;
  logFailure(input: {
    deviceId: string;
    deviceCode: string;
    errorCode: string;
  }): void;
};

type OfflineIncidentTransactionResult = {
  created: boolean;
  existing: boolean;
  alertId: string | null;
  escalated: boolean;
  markedOffline: boolean;
  skipped: "CONCURRENT_RECOVERY" | "UNCONFIRMED_RECOVERY" | null;
};

export type ResolveOfflineAlertsInput = {
  plotId: string;
  resolvedAt: Date;
};

export type ResolveOfflineAlertsUpdate = {
  where: {
    plotId: string;
    type: "DEVICE_OFFLINE";
    resolved: false;
  };
  data: {
    resolved: true;
    resolvedAt: Date;
  };
};

export function getOfflinePolicyDecision({
  now,
  lastSeenAt,
  deviceStatus,
  plotStatus,
}: {
  now: Date;
  lastSeenAt: Date | null;
  deviceStatus: DeviceStatus;
  plotStatus: PlotStatus;
}): OfflinePolicyDecision {
  if (
    !lastSeenAt ||
    EXCLUDED_DEVICE_STATUSES.includes(deviceStatus) ||
    !OPERATIONAL_PLOT_STATUSES.includes(plotStatus)
  ) {
    return { eligible: false, elapsedMs: null, severity: null };
  }

  const nowMs = now.getTime();
  const lastSeenMs = lastSeenAt.getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastSeenMs)) {
    return { eligible: false, elapsedMs: null, severity: null };
  }

  const elapsedMs = Math.max(0, nowMs - lastSeenMs);
  if (elapsedMs < DEVICE_OFFLINE_THRESHOLD_MS) {
    return { eligible: false, elapsedMs, severity: null };
  }

  return {
    eligible: true,
    elapsedMs,
    severity:
      elapsedMs > CRITICAL_OFFLINE_THRESHOLD_MS ? "CRITICAL" : "WARNING",
  };
}

export async function resolveDeviceOfflineForHeartbeat({
  plotId,
  resolvedAt,
  updateMany,
}: ResolveOfflineAlertsInput & {
  updateMany(
    update: ResolveOfflineAlertsUpdate
  ): Promise<{ count: number }>;
}): Promise<number> {
  const result = await updateMany({
    where: {
      plotId,
      type: "DEVICE_OFFLINE",
      resolved: false,
    },
    data: {
      resolved: true,
      resolvedAt,
    },
  });

  return result.count;
}

export async function scanOfflineDevices({
  now,
  sendNotifications = true,
  dependencies,
}: {
  now: Date;
  sendNotifications?: boolean;
  dependencies?: DeviceOfflineScanDependencies;
}): Promise<OfflineScanSummary> {
  const deps = dependencies ?? (await createProductionDependencies());
  const cutoff = new Date(now.getTime() - DEVICE_OFFLINE_THRESHOLD_MS);
  const devices = await deps.findEligibleDevices(cutoff);
  const summary: OfflineScanSummary = {
    scanned: devices.length,
    markedOffline: 0,
    createdAlerts: 0,
    existingAlerts: 0,
    escalatedAlerts: 0,
    notificationAttempts: 0,
    skippedConcurrentRecovery: 0,
    skippedUnconfirmedRecovery: 0,
    failures: 0,
  };

  for (const device of devices) {
    try {
      const policy = getOfflinePolicyDecision({
        now,
        lastSeenAt: device.lastSeenAt,
        deviceStatus: device.status,
        plotStatus: device.plot.status,
      });
      const { elapsedMs, severity } = policy;
      const lastSeenAt = device.lastSeenAt;
      if (
        !policy.eligible ||
        elapsedMs === null ||
        severity === null ||
        !lastSeenAt
      ) {
        continue;
      }

      let suggestion: AlertSuggestion | null = null;
      try {
        suggestion = deps.buildSuggestion();
      } catch {
        // Suggestions are optional; alert creation must continue without one.
      }

      const message = buildOfflineMessage(device, elapsedMs);
      const result = await deps.runInTransaction((transaction) =>
        processOfflineIncident({
          transaction,
          device: {
            ...device,
            lastSeenAt,
          },
          cutoff,
          severity,
          message,
          suggestion,
        })
      );

      if (result.markedOffline) {
        summary.markedOffline++;
      }
      if (result.existing) {
        summary.existingAlerts++;
      }
      if (result.escalated) {
        summary.escalatedAlerts++;
      }
      if (result.skipped === "CONCURRENT_RECOVERY") {
        summary.skippedConcurrentRecovery++;
        continue;
      }
      if (result.skipped === "UNCONFIRMED_RECOVERY") {
        summary.skippedUnconfirmedRecovery++;
        continue;
      }
      if (!result.created || !result.alertId) {
        continue;
      }

      summary.createdAlerts++;
      if (sendNotifications) {
        summary.notificationAttempts++;
        await deps.sendNotifications({
          alert: { id: result.alertId },
          device,
          severity,
          message,
          suggestion,
        });
      }
    } catch (error) {
      summary.failures++;
      deps.logFailure({
        deviceId: device.id,
        deviceCode: device.deviceCode,
        errorCode: getErrorCode(error),
      });
    }
  }

  return summary;
}

async function processOfflineIncident({
  transaction,
  device,
  cutoff,
  severity,
  message,
  suggestion,
}: {
  transaction: DeviceOfflineIncidentTransaction;
  device: OfflineDeviceCandidate & { lastSeenAt: Date };
  cutoff: Date;
  severity: AlertSeverity;
  message: string;
  suggestion: AlertSuggestion | null;
}): Promise<OfflineIncidentTransactionResult> {
  const updated = await transaction.markOfflineIfStillEligible({
    deviceId: device.id,
    cutoff,
  });
  if (updated === 0) {
    return {
      created: false,
      existing: false,
      alertId: null,
      escalated: false,
      markedOffline: false,
      skipped: "CONCURRENT_RECOVERY",
    };
  }

  const markedOffline = device.status !== "OFFLINE";
  let alert = await transaction.findOpenAlert(device.plotId);

  if (!alert) {
    const latestResolved = await transaction.findLatestResolvedAlert(
      device.plotId
    );
    if (
      latestResolved &&
      (!latestResolved.resolvedAt ||
        device.lastSeenAt.getTime() < latestResolved.resolvedAt.getTime())
    ) {
      return {
        created: false,
        existing: false,
        alertId: null,
        escalated: false,
        markedOffline,
        skipped: "UNCONFIRMED_RECOVERY",
      };
    }

    const createdResult = await transaction.createOpenAlert({
      plotId: device.plotId,
      severity,
      message,
      suggestion,
    });
    alert = createdResult.alert;

    if (createdResult.created) {
      return {
        created: true,
        existing: false,
        alertId: alert.id,
        escalated: false,
        markedOffline,
        skipped: null,
      };
    }
  }

  const needsRefresh =
    alert.severity !== severity ||
    alert.message !== message ||
    alert.suggestionTitle !== (suggestion?.title ?? null) ||
    !sameSteps(alert.suggestionSteps, suggestion?.steps ?? []);

  if (!needsRefresh) {
    return {
      created: false,
      existing: true,
      alertId: alert.id,
      escalated: false,
      markedOffline,
      skipped: null,
    };
  }

  const isEscalation =
    alert.severity === "WARNING" && severity === "CRITICAL";
  const refreshed = await transaction.refreshOpenAlert({
    alertId: alert.id,
    plotId: device.plotId,
    severity,
    message,
    suggestion,
  });

  return {
    created: false,
    existing: true,
    alertId: alert.id,
    escalated: refreshed > 0 && isEscalation,
    markedOffline,
    skipped: refreshed === 0 ? "CONCURRENT_RECOVERY" : null,
  };
}

function buildOfflineMessage(
  device: OfflineDeviceCandidate,
  elapsedMs: number
): string {
  return `Device ${device.deviceCode} has not reported readings for ${formatElapsed(
    elapsedMs
  )}. Check that the device has power, is within WiFi range, and the WiFi network is 2.4GHz.`;
}

function formatElapsed(ms: number): string {
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function sameSteps(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((step, index) => step === right[index])
  );
}

function getErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}

async function createProductionDependencies(): Promise<DeviceOfflineScanDependencies> {
  const [
    { prisma },
    { createOpenAlertIfAbsent },
    { getEligibleAlertRecipients },
    { sendAlertNotifications },
    { buildAlertSuggestion },
  ] = await Promise.all([
    import("@/lib/prisma"),
    import("./open-alert"),
    import("./recipients"),
    import("./processor"),
    import("./suggestions"),
  ]);

  return {
    findEligibleDevices: (cutoff) =>
      prisma.device.findMany({
        where: {
          lastSeenAt: { not: null, lte: cutoff },
          status: { notIn: EXCLUDED_DEVICE_STATUSES },
          plot: {
            status: { in: OPERATIONAL_PLOT_STATUSES },
          },
        },
        select: {
          id: true,
          deviceCode: true,
          plotId: true,
          status: true,
          lastSeenAt: true,
          plot: {
            select: {
              name: true,
              status: true,
            },
          },
        },
      }),
    runInTransaction: (operation) =>
      prisma.$transaction((client) =>
        operation({
          markOfflineIfStillEligible: async ({ deviceId, cutoff }) => {
            const result = await client.device.updateMany({
              where: {
                id: deviceId,
                lastSeenAt: { not: null, lte: cutoff },
                status: { notIn: EXCLUDED_DEVICE_STATUSES },
                plot: {
                  status: { in: OPERATIONAL_PLOT_STATUSES },
                },
              },
              data: { status: "OFFLINE" },
            });
            return result.count;
          },
          findOpenAlert: (plotId) =>
            client.alert.findFirst({
              where: {
                plotId,
                type: "DEVICE_OFFLINE",
                resolved: false,
              },
              select: {
                id: true,
                plotId: true,
                severity: true,
                message: true,
                resolved: true,
                resolvedAt: true,
                createdAt: true,
                suggestionTitle: true,
                suggestionSteps: true,
              },
            }),
          findLatestResolvedAlert: (plotId) =>
            client.alert.findFirst({
              where: {
                plotId,
                type: "DEVICE_OFFLINE",
                resolved: true,
              },
              orderBy: { resolvedAt: "desc" },
              select: { resolvedAt: true },
            }),
          createOpenAlert: async ({
            plotId,
            severity,
            message,
            suggestion,
          }) => {
            const result = await createOpenAlertIfAbsent({
              plotId,
              type: "DEVICE_OFFLINE",
              data: {
                severity,
                message,
                suggestionTitle: suggestion?.title ?? null,
                suggestionSteps: suggestion?.steps ?? [],
              },
              client,
            });
            return {
              alert: result.alert,
              created: result.created,
            };
          },
          refreshOpenAlert: async ({
            alertId,
            plotId,
            severity,
            message,
            suggestion,
          }) => {
            const result = await client.alert.updateMany({
              where: {
                id: alertId,
                plotId,
                type: "DEVICE_OFFLINE",
                resolved: false,
              },
              data: {
                severity,
                message,
                suggestionTitle: suggestion?.title ?? null,
                suggestionSteps: suggestion?.steps ?? [],
              },
            });
            return result.count;
          },
        })
      ),
    buildSuggestion: () => buildAlertSuggestion({ type: "DEVICE_OFFLINE" }),
    sendNotifications: async ({
      alert,
      device,
      severity,
      message,
      suggestion,
    }) => {
      const recipients = await getEligibleAlertRecipients(device.plotId);
      await sendAlertNotifications(alert, recipients, {
        plotId: device.plotId,
        plotName: device.plot.name,
        alertType: "DEVICE_OFFLINE",
        severity,
        message,
        suggestion,
      });
    },
    logFailure: ({ deviceId, deviceCode, errorCode }) => {
      console.error("[device-offline] device scan failed", {
        deviceId,
        deviceCode,
        errorCode,
      });
    },
  };
}
