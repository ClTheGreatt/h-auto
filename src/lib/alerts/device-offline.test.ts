import assert from "node:assert/strict";
import { test } from "node:test";
import type { DeviceStatus, PlotStatus } from "@prisma/client";
import {
  getOfflinePolicyDecision,
  resolveDeviceOfflineForHeartbeat,
  scanOfflineDevices,
  type DeviceOfflineIncidentTransaction,
  type DeviceOfflineScanDependencies,
  type OfflineAlertRecord,
  type OfflineDeviceCandidate,
} from "./device-offline";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function ago(milliseconds: number): Date {
  return new Date(NOW.getTime() - milliseconds);
}

function candidate(
  overrides: Partial<OfflineDeviceCandidate> = {}
): OfflineDeviceCandidate {
  const { plot: plotOverrides, ...deviceOverrides } = overrides;
  return {
    id: "device-1",
    deviceCode: "DEVICE-001",
    plotId: "plot-1",
    status: "ONLINE",
    lastSeenAt: ago(30 * 60 * 1000),
    ...deviceOverrides,
    plot: {
      name: plotOverrides?.name ?? "Plot 1",
      status: plotOverrides?.status ?? "PLANTED",
    },
  };
}

function alertRecord(
  overrides: Partial<OfflineAlertRecord> = {}
): OfflineAlertRecord {
  return {
    id: "alert-1",
    plotId: "plot-1",
    severity: "WARNING",
    message: "Original message",
    resolved: false,
    resolvedAt: null,
    createdAt: new Date("2026-07-30T10:00:00.000Z"),
    suggestionTitle: null,
    suggestionSteps: [],
    ...overrides,
  };
}

function cloneAlert(
  value: OfflineAlertRecord | null
): OfflineAlertRecord | null {
  return value
    ? {
        ...value,
        resolvedAt: value.resolvedAt
          ? new Date(value.resolvedAt.getTime())
          : null,
        createdAt: new Date(value.createdAt.getTime()),
        suggestionSteps: [...value.suggestionSteps],
      }
    : null;
}

function createFakeDependencies({
  devices = [candidate()],
  markCount = 1,
  openAlert = null,
  latestResolvedAt = null,
}: {
  devices?: OfflineDeviceCandidate[];
  markCount?: number;
  openAlert?: OfflineAlertRecord | null;
  latestResolvedAt?: Date | null;
} = {}) {
  const state: {
    openAlert: OfflineAlertRecord | null;
    latestResolvedAt: Date | null;
    notifications: number;
    createCalls: number;
    refreshCalls: number;
    failures: string[];
    nextAlertNumber: number;
    transactionCalls: number;
    transactionCommits: number;
    transactionRollbacks: number;
    transactionActive: boolean;
    transactionClients: DeviceOfflineIncidentTransaction[];
    operationClients: Array<{
      operation: string;
      client: DeviceOfflineIncidentTransaction;
    }>;
    notificationTransactionStates: boolean[];
    notificationCommitCounts: number[];
    commitFailureDeviceIds: Set<string>;
    markHandler(input: { deviceId: string; cutoff: Date }): Promise<number>;
  } = {
    openAlert,
    latestResolvedAt,
    notifications: 0,
    createCalls: 0,
    refreshCalls: 0,
    failures: [],
    nextAlertNumber: 1,
    transactionCalls: 0,
    transactionCommits: 0,
    transactionRollbacks: 0,
    transactionActive: false,
    transactionClients: [],
    operationClients: [],
    notificationTransactionStates: [],
    notificationCommitCounts: [],
    commitFailureDeviceIds: new Set(),
    markHandler: async () => markCount,
  };

  const dependencies: DeviceOfflineScanDependencies = {
    findEligibleDevices: async () => devices,
    runInTransaction: async (operation) => {
      const alertSnapshot = cloneAlert(state.openAlert);
      const latestResolvedAtSnapshot = state.latestResolvedAt
        ? new Date(state.latestResolvedAt.getTime())
        : null;
      let transactionDeviceId: string | null = null;
      const transaction: DeviceOfflineIncidentTransaction = {
        markOfflineIfStillEligible: async (input) => {
          transactionDeviceId = input.deviceId;
          state.operationClients.push({
            operation: "markOfflineIfStillEligible",
            client: transaction,
          });
          return state.markHandler(input);
        },
        findOpenAlert: async () => {
          state.operationClients.push({
            operation: "findOpenAlert",
            client: transaction,
          });
          return state.openAlert && !state.openAlert.resolved
            ? state.openAlert
            : null;
        },
        findLatestResolvedAlert: async () => {
          state.operationClients.push({
            operation: "findLatestResolvedAlert",
            client: transaction,
          });
          return state.latestResolvedAt
            ? { resolvedAt: state.latestResolvedAt }
            : null;
        },
        createOpenAlert: async (input) => {
          state.operationClients.push({
            operation: "createOpenAlert",
            client: transaction,
          });
          state.createCalls++;
          if (state.openAlert && !state.openAlert.resolved) {
            return { alert: state.openAlert, created: false };
          }

          state.nextAlertNumber++;
          state.openAlert = alertRecord({
            id: `alert-${state.nextAlertNumber}`,
            plotId: input.plotId,
            severity: input.severity,
            message: input.message,
            suggestionTitle: input.suggestion?.title ?? null,
            suggestionSteps: input.suggestion?.steps ?? [],
            createdAt: NOW,
          });
          return { alert: state.openAlert, created: true };
        },
        refreshOpenAlert: async (input) => {
          state.operationClients.push({
            operation: "refreshOpenAlert",
            client: transaction,
          });
          if (!state.openAlert || state.openAlert.resolved) return 0;
          state.refreshCalls++;
          state.openAlert.severity = input.severity;
          state.openAlert.message = input.message;
          state.openAlert.suggestionTitle = input.suggestion?.title ?? null;
          state.openAlert.suggestionSteps = input.suggestion?.steps ?? [];
          return 1;
        },
      };

      state.transactionCalls++;
      state.transactionClients.push(transaction);
      state.transactionActive = true;
      try {
        const result = await operation(transaction);
        if (
          transactionDeviceId &&
          state.commitFailureDeviceIds.has(transactionDeviceId)
        ) {
          throw Object.assign(new Error("commit failed"), {
            code: "TEST_COMMIT_FAILURE",
          });
        }
        state.transactionCommits++;
        return result;
      } catch (error) {
        state.openAlert = alertSnapshot;
        state.latestResolvedAt = latestResolvedAtSnapshot;
        state.transactionRollbacks++;
        throw error;
      } finally {
        state.transactionActive = false;
      }
    },
    buildSuggestion: () => ({
      title: "Check the device",
      steps: ["Inspect power and connectivity."],
    }),
    sendNotifications: async () => {
      state.notificationTransactionStates.push(state.transactionActive);
      state.notificationCommitCounts.push(state.transactionCommits);
      state.notifications++;
    },
    logFailure: ({ errorCode }) => {
      state.failures.push(errorCode);
    },
  };

  return { dependencies, state };
}

test("offline policy uses the approved time boundaries", () => {
  const cases = [
    { elapsedMs: 14 * 60 * 1000 + 59 * 1000, eligible: false },
    { elapsedMs: 15 * 60 * 1000, eligible: false },
    { elapsedMs: 29 * 60 * 1000 + 59 * 1000, eligible: false },
    {
      elapsedMs: 30 * 60 * 1000,
      eligible: true,
      severity: "WARNING",
    },
    {
      elapsedMs: 120 * 60 * 1000,
      eligible: true,
      severity: "WARNING",
    },
    {
      elapsedMs: 120 * 60 * 1000 + 1,
      eligible: true,
      severity: "CRITICAL",
    },
  ] as const;

  for (const item of cases) {
    const decision = getOfflinePolicyDecision({
      now: NOW,
      lastSeenAt: ago(item.elapsedMs),
      deviceStatus: "ONLINE",
      plotStatus: "PLANTED",
    });
    assert.equal(decision.eligible, item.eligible);
    assert.equal(
      decision.severity,
      "severity" in item ? item.severity : null
    );
  }
});

test("null timestamps and excluded plot/device states are skipped", () => {
  const excludedPlotStatuses: PlotStatus[] = [
    "PREPARING",
    "HARVESTED",
    "FALLOW",
    "ARCHIVED",
  ];
  const excludedDeviceStatuses: DeviceStatus[] = ["MAINTENANCE", "RETIRED"];

  assert.equal(
    getOfflinePolicyDecision({
      now: NOW,
      lastSeenAt: null,
      deviceStatus: "ONLINE",
      plotStatus: "PLANTED",
    }).eligible,
    false
  );

  for (const plotStatus of excludedPlotStatuses) {
    assert.equal(
      getOfflinePolicyDecision({
        now: NOW,
        lastSeenAt: ago(31 * 60 * 1000),
        deviceStatus: "ONLINE",
        plotStatus,
      }).eligible,
      false
    );
  }

  for (const deviceStatus of excludedDeviceStatuses) {
    assert.equal(
      getOfflinePolicyDecision({
        now: NOW,
        lastSeenAt: ago(31 * 60 * 1000),
        deviceStatus,
        plotStatus: "PLANTED",
      }).eligible,
      false
    );
  }
});

test("all operational plot states remain eligible", () => {
  for (const plotStatus of [
    "PLANTED",
    "GROWING",
    "READY_FOR_HARVEST",
  ] satisfies PlotStatus[]) {
    assert.equal(
      getOfflinePolicyDecision({
        now: NOW,
        lastSeenAt: ago(30 * 60 * 1000),
        deviceStatus: "OFFLINE",
        plotStatus,
      }).eligible,
      true
    );
  }
});

test("a zero-row conditional update skips alert creation", async () => {
  const { dependencies, state } = createFakeDependencies({ markCount: 0 });
  const summary = await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(summary.skippedConcurrentRecovery, 1);
  assert.equal(summary.createdAlerts, 0);
  assert.equal(summary.notificationAttempts, 0);
  assert.equal(state.createCalls, 0);
  assert.equal(state.notifications, 0);
});

test("stale revalidation and alert creation use one transaction client", async () => {
  const { dependencies, state } = createFakeDependencies();

  await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(state.transactionCalls, 1);
  assert.equal(state.transactionCommits, 1);
  assert.deepEqual(
    state.operationClients.map(({ operation }) => operation),
    [
      "markOfflineIfStillEligible",
      "findOpenAlert",
      "findLatestResolvedAlert",
      "createOpenAlert",
    ]
  );
  assert.ok(
    state.operationClients.every(
      ({ client }) => client === state.transactionClients[0]
    )
  );
});

test("a new incident notifies once and repeated scans do not resend", async () => {
  const { dependencies, state } = createFakeDependencies();

  const first = await scanOfflineDevices({ now: NOW, dependencies });
  const second = await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(first.createdAlerts, 1);
  assert.equal(first.notificationAttempts, 1);
  assert.equal(second.createdAlerts, 0);
  assert.equal(second.existingAlerts, 1);
  assert.equal(second.notificationAttempts, 0);
  assert.equal(state.notifications, 1);
  assert.deepEqual(state.notificationTransactionStates, [false]);
  assert.deepEqual(state.notificationCommitCounts, [1]);
});

test("a failed transaction rolls back and sends no notification", async () => {
  const { dependencies, state } = createFakeDependencies();
  state.commitFailureDeviceIds.add("device-1");

  const summary = await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(summary.failures, 1);
  assert.equal(summary.markedOffline, 0);
  assert.equal(summary.createdAlerts, 0);
  assert.equal(summary.notificationAttempts, 0);
  assert.equal(state.transactionCommits, 0);
  assert.equal(state.transactionRollbacks, 1);
  assert.equal(state.openAlert, null);
  assert.equal(state.notifications, 0);
  assert.deepEqual(state.failures, ["TEST_COMMIT_FAILURE"]);
});

test("an existing Warning escalates after two hours without changing createdAt", async () => {
  const createdAt = new Date("2026-07-30T08:00:00.000Z");
  const existing = alertRecord({ createdAt });
  const oldDevice = candidate({
    lastSeenAt: ago(121 * 60 * 1000),
  });
  const { dependencies, state } = createFakeDependencies({
    devices: [oldDevice],
    openAlert: existing,
  });

  const summary = await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(summary.existingAlerts, 1);
  assert.equal(summary.escalatedAlerts, 1);
  assert.equal(summary.notificationAttempts, 0);
  assert.equal(state.notifications, 0);
  assert.equal(state.openAlert?.severity, "CRITICAL");
  assert.equal(state.openAlert?.createdAt.getTime(), createdAt.getTime());
});

test("one device transaction failure does not stop later devices or corrupt counters", async () => {
  const devices = [
    candidate({ id: "device-fails", deviceCode: "FAIL-001" }),
    candidate({ id: "device-works", deviceCode: "OK-001", plotId: "plot-2" }),
  ];
  const { dependencies, state } = createFakeDependencies({ devices });
  state.markHandler = async ({ deviceId }) => {
    if (deviceId === "device-fails") {
      throw Object.assign(new Error("failed"), { code: "TEST_FAILURE" });
    }
    return 1;
  };

  const summary = await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(summary.scanned, 2);
  assert.equal(summary.failures, 1);
  assert.equal(summary.markedOffline, 1);
  assert.equal(summary.createdAlerts, 1);
  assert.equal(summary.existingAlerts, 0);
  assert.equal(summary.escalatedAlerts, 0);
  assert.equal(summary.notificationAttempts, 1);
  assert.equal(summary.skippedConcurrentRecovery, 0);
  assert.equal(summary.skippedUnconfirmedRecovery, 0);
  assert.equal(state.transactionCalls, 2);
  assert.equal(state.transactionCommits, 1);
  assert.equal(state.transactionRollbacks, 1);
  assert.equal(state.notifications, 1);
  assert.deepEqual(state.failures, ["TEST_FAILURE"]);
});

test("ingestion-first ordering makes cron revalidation a no-op", async () => {
  const { dependencies, state } = createFakeDependencies();
  const recoveryCommitted = true;
  state.markHandler = async () => (recoveryCommitted ? 0 : 1);

  const summary = await scanOfflineDevices({ now: NOW, dependencies });

  assert.equal(summary.skippedConcurrentRecovery, 1);
  assert.equal(summary.createdAlerts, 0);
  assert.equal(state.createCalls, 0);
  assert.equal(state.notifications, 0);
});

test("cron-first ordering commits an alert that recovery can resolve", async () => {
  const { dependencies, state } = createFakeDependencies();

  const summary = await scanOfflineDevices({ now: NOW, dependencies });
  assert.equal(summary.createdAlerts, 1);
  assert.equal(state.openAlert?.resolved, false);

  const resolved = await resolveDeviceOfflineForHeartbeat({
    plotId: "plot-1",
    resolvedAt: NOW,
    updateMany: async ({ data }) => {
      if (!state.openAlert || state.openAlert.resolved) return { count: 0 };
      state.openAlert.resolved = true;
      state.openAlert.resolvedAt = data.resolvedAt;
      return { count: 1 };
    },
  });

  assert.equal(resolved, 1);
  assert.equal(state.openAlert?.resolved, true);
  assert.equal(state.openAlert?.resolvedAt?.getTime(), NOW.getTime());
});

test("heartbeat recovery is synchronous and idempotent", async () => {
  let open = true;
  const state: { resolvedAt: Date | null } = { resolvedAt: null };
  const updateMany = async () => {
    if (!open) return { count: 0 };
    open = false;
    state.resolvedAt = NOW;
    return { count: 1 };
  };

  const first = await resolveDeviceOfflineForHeartbeat({
    plotId: "plot-1",
    resolvedAt: NOW,
    updateMany,
  });
  const second = await resolveDeviceOfflineForHeartbeat({
    plotId: "plot-1",
    resolvedAt: NOW,
    updateMany,
  });

  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(state.resolvedAt?.getTime(), NOW.getTime());
});

test("a later outage creates a new incident only after confirmed recovery", async () => {
  const recoveryAt = new Date("2026-07-30T11:00:00.000Z");
  const previous = alertRecord();
  const nextOutageDevice = candidate({
    status: "ONLINE",
    lastSeenAt: recoveryAt,
  });
  const { dependencies, state } = createFakeDependencies({
    devices: [nextOutageDevice],
    openAlert: previous,
  });

  await resolveDeviceOfflineForHeartbeat({
    plotId: "plot-1",
    resolvedAt: recoveryAt,
    updateMany: async ({ data }) => {
      if (!state.openAlert || state.openAlert.resolved) return { count: 0 };
      state.openAlert.resolved = true;
      state.openAlert.resolvedAt = data.resolvedAt;
      state.latestResolvedAt = data.resolvedAt;
      return { count: 1 };
    },
  });

  const later = new Date(recoveryAt.getTime() + 31 * 60 * 1000);
  const summary = await scanOfflineDevices({
    now: later,
    dependencies,
  });

  assert.equal(summary.createdAlerts, 1);
  assert.equal(summary.notificationAttempts, 1);
  assert.equal(state.openAlert?.resolved, false);
  assert.notEqual(state.openAlert?.id, previous.id);
});

test("manual resolution without a newer heartbeat does not start a new incident", async () => {
  const lastSeenAt = new Date("2026-07-30T10:00:00.000Z");
  const manuallyResolvedAt = new Date("2026-07-30T10:30:00.000Z");
  const { dependencies, state } = createFakeDependencies({
    devices: [candidate({ status: "OFFLINE", lastSeenAt })],
    latestResolvedAt: manuallyResolvedAt,
  });

  const summary = await scanOfflineDevices({
    now: new Date("2026-07-30T12:30:00.000Z"),
    dependencies,
  });

  assert.equal(summary.skippedUnconfirmedRecovery, 1);
  assert.equal(summary.createdAlerts, 0);
  assert.equal(state.createCalls, 0);
  assert.equal(state.notifications, 0);
});
