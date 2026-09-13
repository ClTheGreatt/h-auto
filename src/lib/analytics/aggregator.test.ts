import assert from "node:assert/strict";
import test from "node:test";
import type { CropStage, SensorReading } from "@prisma/client";
import { calculateOptimalPercent, downsample } from "./aggregator";

const stage: CropStage = {
  id: "stage-1",
  cropId: "crop-1",
  name: "Test stage",
  orderIndex: 1,
  durationDays: 7,
  description: null,
  minSoilMoisture: 1,
  maxSoilMoisture: 10,
  minTemperature: 1,
  maxTemperature: 10,
  minHumidity: 1,
  maxHumidity: 10,
  minLightIntensity: 1,
  maxLightIntensity: 10,
  minNitrogen: 1,
  maxNitrogen: 10,
  minPhosphorus: 1,
  maxPhosphorus: 10,
  minPotassium: 1,
  maxPotassium: 10,
};

function reading(values: Partial<SensorReading> = {}): SensorReading {
  return {
    id: "reading-1",
    deviceId: "device-1",
    plotId: "plot-1",
    recordedAt: new Date("2026-01-01T00:00:00.000Z"),
    soilMoisture: null,
    temperature: null,
    humidity: null,
    lightIntensity: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    ...values,
  };
}

test("health is unavailable when there are no readings", () => {
  assert.equal(calculateOptimalPercent([], stage), null);
});

test("health is unavailable when there is no current stage", () => {
  assert.equal(calculateOptimalPercent([reading({ soilMoisture: 5 })], null), null);
});

test("health is unavailable when readings have no evaluable values", () => {
  assert.equal(calculateOptimalPercent([reading()], stage), null);
});

test("a legitimate zero sensor value remains an evaluated numeric zero", () => {
  assert.equal(
    calculateOptimalPercent([reading({ soilMoisture: 0 })], stage),
    0
  );
});

test("partially optimal readings retain a numeric percentage", () => {
  assert.equal(
    calculateOptimalPercent(
      [reading({ soilMoisture: 5, temperature: 20 })],
      stage
    ),
    50
  );
});

test("fully optimal readings retain a numeric 100 percent", () => {
  assert.equal(
    calculateOptimalPercent(
      [reading({ soilMoisture: 5, temperature: 5 })],
      stage
    ),
    100
  );
});

test("downsampling returns inputs at or below the limit unchanged", () => {
  const values = [1, 2, 3];
  assert.equal(downsample(values, 3), values);
  assert.equal(downsample(values, 4), values);
});

test("downsampling preserves ordered endpoints without exceeding the limit", () => {
  const values = Array.from({ length: 10 }, (_, index) => index);
  const sampled = downsample(values, 4);

  assert.deepEqual(sampled, [0, 3, 6, 9]);
  assert.equal(sampled[0], values[0]);
  assert.equal(sampled.at(-1), values.at(-1));
  assert.equal(sampled.length, 4);
  assert.equal(new Set(sampled).size, sampled.length);
  assert.ok(
    sampled.every(
      (value, index) => index === 0 || sampled[index - 1] < value
    )
  );
});
