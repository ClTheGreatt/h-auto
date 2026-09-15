import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDateTime } from "@/lib/format-date";
import {
  summarizeActivity,
  summarizeAlerts,
  summarizeGrowthLogs,
  summarizePlotPerformance,
  summarizeSensorReadings,
  summarizeStudentActivity,
} from "./summaries";

function sensorRow(
  overrides: Partial<Parameters<typeof summarizeSensorReadings>[0][number]> = {}
) {
  return {
    recordedAt: new Date("2026-09-14T08:00:00+08:00"),
    soilMoisture: null,
    temperature: null,
    humidity: null,
    lightIntensity: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    ...overrides,
  };
}

function metric(
  items: Array<{ label: string; value: string | number }>,
  label: string
) {
  return items.find((item) => item.label === label)?.value;
}

test("sensor statistics use valid per-field samples and the latest included time", () => {
  const latest = new Date("2026-09-15T09:00:00+08:00");
  const summary = summarizeSensorReadings([
    sensorRow({ temperature: 10, soilMoisture: 30 }),
    sensorRow({
      recordedAt: latest,
      temperature: 20,
      soilMoisture: null,
      humidity: 70,
    }),
    sensorRow({ temperature: Number.NaN, soilMoisture: Infinity }),
  ]);
  assert.equal(metric(summary.items, "Included readings"), 3);
  assert.equal(
    metric(summary.items, "Latest included reading"),
    formatDateTime(latest)
  );
  const temperature = summary.table?.rows[1];
  const moisture = summary.table?.rows[0];
  const humidity = summary.table?.rows[2];
  assert.deepEqual(temperature, [
    "Temperature (°C)",
    2,
    10,
    15,
    20,
  ]);
  assert.equal(moisture?.[1], 1);
  assert.equal(humidity?.[1], 1);
  assert.doesNotMatch(JSON.stringify(summary), /NaN|Infinity|undefined|null/);
});

test("sensor zero and one-valid-value cases remain neutral and factual", () => {
  const empty = summarizeSensorReadings([]);
  assert.equal(metric(empty.items, "Included readings"), 0);
  assert.deepEqual(empty.table?.rows[0], [
    "Soil Moisture (%)",
    0,
    "-",
    "-",
    "-",
  ]);
  const single = summarizeSensorReadings([
    sensorRow({ nitrogen: 4.5 }),
  ]);
  assert.deepEqual(single.table?.rows[4], [
    "Nitrogen (mg/kg)",
    1,
    4.5,
    4.5,
    4.5,
  ]);
});

test("extreme finite sensor values keep finite numeric min, mean, and max", () => {
  const cases = [
    { label: "one huge sample", values: [1e308], expectedMean: 1e308 },
    { label: "repeated huge samples", values: [1e308, 1e308], expectedMean: 1e308 },
    { label: "opposite-sign huge samples", values: [1e308, -1e308], expectedMean: 0 },
    {
      label: "repeated maximum finite samples",
      values: [Number.MAX_VALUE, Number.MAX_VALUE],
      expectedMean: Number.MAX_VALUE,
    },
    { label: "zero samples", values: [0, 0], expectedMean: 0 },
  ];
  for (const { label, values, expectedMean } of cases) {
    const row = summarizeSensorReadings(
      values.map((lightIntensity) => sensorRow({ lightIntensity }))
    ).table?.rows[3];
    assert.ok(row, label);
    assert.equal(row[1], values.length, label);
    assert.equal(row[2], Math.min(...values), label);
    assert.equal(row[4], Math.max(...values), label);
    for (const index of [2, 3, 4]) {
      assert.equal(typeof row[index], "number", label);
      assert.ok(Number.isFinite(row[index]), label);
    }
    const average = row[3] as number;
    if (expectedMean === 0) {
      assert.equal(average, 0, label);
    } else {
      assert.ok(Math.abs(average / expectedMean - 1) < 1e-12, label);
    }
  }
  assert.equal(
    summarizeSensorReadings([sensorRow({ lightIntensity: 1.234 })]).table?.rows[3]?.[3],
    1.2
  );
});

test("invalid sensor values are excluded while zero remains a valid sample", () => {
  const row = summarizeSensorReadings([
    sensorRow({ lightIntensity: null }),
    sensorRow({ lightIntensity: undefined }),
    sensorRow({ lightIntensity: Number.NaN }),
    sensorRow({ lightIntensity: Infinity }),
    sensorRow({ lightIntensity: -Infinity }),
    sensorRow({ lightIntensity: 0 }),
  ]).table?.rows[3];
  assert.deepEqual(row, ["Light (lux)", 1, 0, 0, 0]);
});

test("plot summary follows canonical lifecycle and separates range from current alerts", () => {
  const summary = summarizePlotPerformance([
    { status: "PREPARING", readingCount: 2, logCount: 0, alertCount: 0, openAlertCount: 5 },
    { status: "GROWING", readingCount: 3, logCount: 1, alertCount: 0, openAlertCount: 0 },
    { status: "ARCHIVED", readingCount: 0, logCount: 2, alertCount: 0, openAlertCount: 0 },
  ]);
  assert.equal(metric(summary.items, "Plots represented"), 3);
  assert.equal(metric(summary.items, "Setup plots (current)"), 1);
  assert.equal(metric(summary.items, "Operational plots (current)"), 1);
  assert.equal(metric(summary.items, "Historical plots (current)"), 1);
  assert.equal(metric(summary.items, "Readings in selected range"), 5);
  assert.equal(metric(summary.items, "Growth logs in selected range"), 3);
  assert.equal(metric(summary.items, "Alerts in selected range"), 0);
  assert.equal(metric(summary.items, "Current open alerts"), 5);
});

test("growth summary counts included logs and logs bearing photos", () => {
  const summary = summarizeGrowthLogs([
    { createdAt: new Date("2026-09-14T08:00:00+08:00"), imageCount: 0 },
    { createdAt: new Date("2026-09-15T08:00:00+08:00"), imageCount: 3 },
  ]);
  assert.equal(metric(summary.items, "Logs included"), 2);
  assert.equal(metric(summary.items, "Logs with photos"), 1);
  assert.equal(
    metric(summary.items, "Latest included log"),
    formatDateTime(new Date("2026-09-15T08:00:00+08:00"))
  );
});

test("alert summary includes INFO and counts open critical separately", () => {
  const summary = summarizeAlerts([
    { severity: "INFO", resolved: true },
    { severity: "WARNING", resolved: false },
    { severity: "CRITICAL", resolved: false },
    { severity: "CRITICAL", resolved: true },
  ]);
  assert.equal(metric(summary.items, "Alerts included"), 4);
  assert.equal(metric(summary.items, "Open"), 2);
  assert.equal(metric(summary.items, "Resolved"), 2);
  assert.equal(metric(summary.items, "Info"), 1);
  assert.equal(metric(summary.items, "Warning"), 1);
  assert.equal(metric(summary.items, "Critical"), 2);
  assert.equal(metric(summary.items, "Open critical"), 1);
});

test("activity summary uses included events and returned type labels", () => {
  const summary = summarizeActivity([
    { timestamp: new Date("2026-09-14T08:00:00+08:00"), eventType: "Import" },
    { timestamp: new Date("2026-09-15T08:00:00+08:00"), eventType: "Assignment" },
    { timestamp: new Date("2026-09-15T09:00:00+08:00"), eventType: "Import" },
  ]);
  assert.equal(metric(summary.items, "Events included"), 3);
  assert.deepEqual(summary.table?.headers, [
    "Included event type",
    "Included events",
  ]);
  assert.deepEqual(summary.table?.rows, [
    ["Assignment", 1],
    ["Import", 2],
  ]);
  assert.equal(metric(summarizeActivity([]).items, "Events included"), 0);
});

test("student summary totals only represented rows", () => {
  const summary = summarizeStudentActivity([
    { plotsAssigned: 2, observationsInRange: 3, photoCount: 4 },
    { plotsAssigned: 1, observationsInRange: 0, photoCount: 2 },
  ]);
  assert.equal(metric(summary.items, "Students represented"), 2);
  assert.equal(metric(summary.items, "Observations in selected range"), 3);
  assert.equal(metric(summary.items, "Photos in selected range"), 6);
  assert.equal(metric(summary.items, "Current active assignments"), 3);
});
