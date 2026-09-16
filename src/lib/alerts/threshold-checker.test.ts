import assert from "node:assert/strict";
import { test } from "node:test";
import type { CropStage } from "@prisma/client";
import {
  evaluateCurrentReading,
  getCurrentReadingCondition,
  type ThresholdReading,
} from "./threshold-checker";

const DAYLIGHT = new Date("2026-09-14T04:00:00.000Z"); // 12:00 Manila

function stage(overrides: Partial<CropStage> = {}): CropStage {
  return {
    id: "stage-1",
    cropId: "crop-1",
    name: "Stage 1",
    orderIndex: 0,
    durationDays: 10,
    description: null,
    referenceImageUrl: null,
    referenceImagePublicId: null,
    expectedAppearance: null,
    observableSigns: [],
    facultyGuidance: null,
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

function reading(overrides: Partial<ThresholdReading> = {}): ThresholdReading {
  return {
    soilMoisture: 50,
    temperature: 25,
    humidity: 65,
    lightIntensity: 300,
    nitrogen: 15,
    phosphorus: 15,
    potassium: 15,
    ...overrides,
  };
}

test("all evaluable values in range have no current severity", () => {
  const result = evaluateCurrentReading(reading(), stage(), DAYLIGHT);

  assert.equal(result.evaluatedSensorCount, 7);
  assert.equal(result.violations.length, 0);
  assert.equal(result.highestSeverity, null);
  assert.equal(getCurrentReadingCondition(result), "CURRENT_IN_RANGE");
});

test("a deviation of at most twenty percent is Warning", () => {
  const result = evaluateCurrentReading(
    reading({ soilMoisture: 35 }),
    stage(),
    DAYLIGHT
  );

  assert.equal(result.violations[0]?.type, "LOW_SOIL_MOISTURE");
  assert.equal(result.highestSeverity, "WARNING");
  assert.equal(getCurrentReadingCondition(result), "CURRENT_WARNING");
});

test("a deviation above twenty percent is Critical", () => {
  const result = evaluateCurrentReading(
    reading({ soilMoisture: 0 }),
    stage(),
    DAYLIGHT
  );

  assert.equal(result.violations[0]?.severity, "CRITICAL");
  assert.equal(result.highestSeverity, "CRITICAL");
  assert.equal(getCurrentReadingCondition(result), "CURRENT_CRITICAL");
});

test("numeric zero remains evaluable", () => {
  const result = evaluateCurrentReading(
    reading({ soilMoisture: 0 }),
    stage({ minSoilMoisture: 0, maxSoilMoisture: 10 }),
    DAYLIGHT
  );

  assert.equal(result.sensors.soilMoisture.evaluated, true);
  assert.equal(result.sensors.soilMoisture.status, "optimal");
});

test("null values produce no evaluable data", () => {
  const result = evaluateCurrentReading(
    reading({
      soilMoisture: null,
      temperature: null,
      humidity: null,
      lightIntensity: null,
      nitrogen: null,
      phosphorus: null,
      potassium: null,
    }),
    stage(),
    DAYLIGHT
  );

  assert.equal(result.evaluatedSensorCount, 0);
  assert.equal(getCurrentReadingCondition(result), "NO_EVALUABLE_DATA");
});

test("exact minimum and maximum values are in range", () => {
  const result = evaluateCurrentReading(
    reading({ soilMoisture: 40, temperature: 30 }),
    stage(),
    DAYLIGHT
  );

  assert.equal(result.sensors.soilMoisture.status, "optimal");
  assert.equal(result.sensors.temperature.status, "optimal");
  assert.equal(result.violations.length, 0);
});

for (const [label, timestamp, evaluated] of [
  ["05:59", "2026-09-13T21:59:00.000Z", false],
  ["06:00", "2026-09-13T22:00:00.000Z", true],
  ["17:59", "2026-09-14T09:59:00.000Z", true],
  ["18:00", "2026-09-14T10:00:00.000Z", false],
] as const) {
  test(`Manila light boundary ${label} is ${evaluated ? "evaluated" : "ignored"}`, () => {
    const result = evaluateCurrentReading(
      reading({ lightIntensity: 0 }),
      stage(),
      new Date(timestamp)
    );

    assert.equal(result.sensors.lightIntensity.evaluated, evaluated);
    assert.equal(
      result.violations.some((violation) => violation.type === "LOW_LIGHT"),
      evaluated
    );
  });
}

test("invalid and non-finite ranges are not evaluable", () => {
  const invalid = evaluateCurrentReading(
    reading({ soilMoisture: 50 }),
    stage({ minSoilMoisture: 60, maxSoilMoisture: 40 }),
    DAYLIGHT
  );
  const nonFinite = evaluateCurrentReading(
    reading({ soilMoisture: 50 }),
    stage({ minSoilMoisture: Number.NaN }),
    DAYLIGHT
  );

  assert.equal(invalid.sensors.soilMoisture.evaluated, false);
  assert.equal(invalid.sensors.soilMoisture.status, "invalid-range");
  assert.equal(nonFinite.sensors.soilMoisture.evaluated, false);
});

test("current condition is independent from zero or stale persisted alerts", () => {
  const violating = evaluateCurrentReading(
    reading({ soilMoisture: 0 }),
    stage(),
    DAYLIGHT
  );
  const healthy = evaluateCurrentReading(reading(), stage(), DAYLIGHT);

  assert.equal(getCurrentReadingCondition(violating), "CURRENT_CRITICAL");
  assert.equal(getCurrentReadingCondition(healthy), "CURRENT_IN_RANGE");
});
