import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  AlertSeverity,
  AlertType,
  CropStage,
  PlotStatus,
} from "@prisma/client";
import {
  processEnvironmentalReading,
  type EnvironmentalProcessorDependencies,
  type EnvironmentalReadingRecord,
} from "./environmental-processor";

const DAYLIGHT = new Date("2026-09-14T04:00:00.000Z");

function stage(
  id: string,
  overrides: Partial<CropStage> = {}
): CropStage {
  return {
    id,
    cropId: `crop-${id}`,
    name: id,
    orderIndex: 0,
    durationDays: 10,
    description: null,
    minSoilMoisture: 40,
    maxSoilMoisture: 60,
    minTemperature: 20,
    maxTemperature: 30,
    minHumidity: 50,
    maxHumidity: 80,
    minLightIntensity: 100,
    maxLightIntensity: 500,
    minNitrogen: 10,
    maxNitrogen: 20,
    minPhosphorus: 10,
    maxPhosphorus: 20,
    minPotassium: 10,
    maxPotassium: 20,
    ...overrides,
  };
}

function reading({
  id,
  deviceId,
  plotId,
  currentStage,
  status = "GROWING",
  values = {},
  recordedAt = DAYLIGHT,
}: {
  id: string;
  deviceId: string;
  plotId: string;
  currentStage: CropStage | null;
  status?: PlotStatus;
  values?: Partial<
    Pick<
      EnvironmentalReadingRecord,
      | "soilMoisture"
      | "temperature"
      | "humidity"
      | "lightIntensity"
      | "nitrogen"
      | "phosphorus"
      | "potassium"
    >
  >;
  recordedAt?: Date;
}): EnvironmentalReadingRecord {
  return {
    id,
    deviceId,
    plotId,
    recordedAt,
    soilMoisture: null,
    temperature: null,
    humidity: null,
    lightIntensity: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    ...values,
    plot: {
      name: plotId,
      status,
      currentStage,
    },
  };
}

type FakeAlert = {
  id: string;
  plotId: string;
  type: AlertType;
  severity: AlertSeverity;
  resolved: boolean;
};

function createDependencies({ failFirstNotification = false } = {}) {
  const alerts: FakeAlert[] = [];
  const notificationAttempts: string[] = [];
  const notificationFailures: string[] = [];
  let nextId = 1;
  let shouldFail = failFirstNotification;

  const dependencies: EnvironmentalProcessorDependencies = {
    persistViolation: async ({ reading: source, violation }) => {
      const existing = alerts.find(
        (alert) =>
          alert.plotId === source.plotId &&
          alert.type === violation.type &&
          !alert.resolved
      );
      if (existing) {
        existing.severity = violation.severity;
        return { alert: existing, created: false };
      }

      const alert: FakeAlert = {
        id: `alert-${nextId++}`,
        plotId: source.plotId,
        type: violation.type,
        severity: violation.severity,
        resolved: false,
      };
      alerts.push(alert);
      return { alert, created: true };
    },
    findOpenAlerts: async (plotId) =>
      alerts
        .filter((alert) => alert.plotId === plotId && !alert.resolved)
        .map(({ id, type }) => ({ id, type })),
    resolveAlert: async (alertId) => {
      const alert = alerts.find((candidate) => candidate.id === alertId);
      if (alert) alert.resolved = true;
    },
    notifyNewAlert: async ({ alert }) => {
      notificationAttempts.push(alert.id);
      if (shouldFail) {
        shouldFail = false;
        throw new Error("notification failed");
      }
    },
    logNotificationFailure: ({ alertId }) => {
      notificationFailures.push(alertId);
    },
  };

  return {
    alerts,
    dependencies,
    notificationAttempts,
    notificationFailures,
  };
}

test("different plots use their own stages and persist alerts to their reading plot", async () => {
  const state = createDependencies();
  const stageA = stage("stage-a");
  const stageB = stage("stage-b", {
    minSoilMoisture: 10,
    maxSoilMoisture: 20,
    minHumidity: 20,
    maxHumidity: 40,
    minLightIntensity: 200,
    maxLightIntensity: 400,
  });

  await processEnvironmentalReading(
    reading({
      id: "reading-a",
      deviceId: "device-shared",
      plotId: "plot-a",
      currentStage: stageA,
      values: { soilMoisture: 35, temperature: 25 },
    }),
    state.dependencies
  );
  await processEnvironmentalReading(
    reading({
      id: "reading-b",
      deviceId: "device-shared",
      plotId: "plot-b",
      currentStage: stageB,
      values: { soilMoisture: 35, humidity: 90, lightIntensity: 0 },
    }),
    state.dependencies
  );

  assert.deepEqual(
    state.alerts
      .filter((alert) => alert.plotId === "plot-a")
      .map((alert) => alert.type),
    ["LOW_SOIL_MOISTURE"]
  );
  assert.deepEqual(
    state.alerts
      .filter((alert) => alert.plotId === "plot-b")
      .map((alert) => alert.type)
      .sort(),
    ["HIGH_HUMIDITY", "HIGH_SOIL_MOISTURE", "LOW_LIGHT"].sort()
  );
  assert.equal(
    state.alerts.some(
      (alert) => alert.plotId === "plot-a" && alert.type === "HIGH_SOIL_MOISTURE"
    ),
    false
  );
});

test("notification failure cannot block other violations or recovery", async () => {
  const state = createDependencies({ failFirstNotification: true });
  state.alerts.push({
    id: "old-temperature",
    plotId: "plot-b",
    type: "HIGH_TEMPERATURE",
    severity: "WARNING",
    resolved: false,
  });

  const result = await processEnvironmentalReading(
    reading({
      id: "reading-b",
      deviceId: "device-b",
      plotId: "plot-b",
      currentStage: stage("stage-b"),
      values: { soilMoisture: 0, humidity: 100, temperature: 25 },
    }),
    state.dependencies
  );

  assert.equal(result.createdAlertCount, 2);
  assert.equal(result.resolvedAlertCount, 1);
  assert.equal(result.notificationFailureCount, 1);
  assert.equal(state.notificationAttempts.length, 2);
  assert.equal(state.notificationFailures.length, 1);
  assert.equal(
    state.alerts.find((alert) => alert.id === "old-temperature")?.resolved,
    true
  );
  assert.deepEqual(
    state.alerts
      .filter((alert) => alert.plotId === "plot-b" && !alert.resolved)
      .map((alert) => alert.type)
      .sort(),
    ["HIGH_HUMIDITY", "LOW_SOIL_MOISTURE"].sort()
  );
});

test("a later evaluated in-range reading resolves the prior violation", async () => {
  const state = createDependencies();
  const currentStage = stage("stage-a");

  await processEnvironmentalReading(
    reading({
      id: "reading-low",
      deviceId: "device-a",
      plotId: "plot-a",
      currentStage,
      values: { soilMoisture: 0 },
    }),
    state.dependencies
  );
  await processEnvironmentalReading(
    reading({
      id: "reading-normal",
      deviceId: "device-a",
      plotId: "plot-a",
      currentStage,
      values: { soilMoisture: 50 },
    }),
    state.dependencies
  );

  assert.equal(state.alerts[0]?.type, "LOW_SOIL_MOISTURE");
  assert.equal(state.alerts[0]?.resolved, true);
});

test("nighttime light is not treated as recovery evidence", async () => {
  const state = createDependencies();
  state.alerts.push({
    id: "low-light",
    plotId: "plot-a",
    type: "LOW_LIGHT",
    severity: "WARNING",
    resolved: false,
  });

  await processEnvironmentalReading(
    reading({
      id: "night-reading",
      deviceId: "device-a",
      plotId: "plot-a",
      currentStage: stage("stage-a"),
      recordedAt: new Date("2026-09-14T10:00:00.000Z"), // 18:00 Manila
      values: { lightIntensity: 300 },
    }),
    state.dependencies
  );

  assert.equal(state.alerts[0]?.resolved, false);
});

test("non-operational plots do not persist environmental alerts", async () => {
  const state = createDependencies();

  const result = await processEnvironmentalReading(
    reading({
      id: "preparing-reading",
      deviceId: "device-a",
      plotId: "plot-a",
      currentStage: stage("stage-a"),
      status: "PREPARING",
      values: { soilMoisture: 0 },
    }),
    state.dependencies
  );

  assert.equal(result.violationCount, 0);
  assert.deepEqual(state.alerts, []);
});
