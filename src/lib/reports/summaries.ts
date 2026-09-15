import { formatDateTime } from "@/lib/format-date";
import {
  HISTORICAL_PLOT_STATUSES,
  OPERATIONAL_PLOT_STATUSES,
  SETUP_PLOT_STATUSES,
} from "@/lib/plots/lifecycle";

export type ReportSummary = {
  items: Array<{ label: string; value: string | number }>;
  table?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
};

type SensorField =
  | "soilMoisture"
  | "temperature"
  | "humidity"
  | "lightIntensity"
  | "nitrogen"
  | "phosphorus"
  | "potassium";

type SensorRow = { recordedAt: Date } & Record<SensorField, number | null>;

const SENSOR_FIELDS: Array<{
  field: SensorField;
  label: string;
  unit: string;
}> = [
  { field: "soilMoisture", label: "Soil Moisture", unit: "%" },
  { field: "temperature", label: "Temperature", unit: "°C" },
  { field: "humidity", label: "Humidity", unit: "%" },
  { field: "lightIntensity", label: "Light", unit: "lux" },
  { field: "nitrogen", label: "Nitrogen", unit: "mg/kg" },
  { field: "phosphorus", label: "Phosphorus", unit: "mg/kg" },
  { field: "potassium", label: "Potassium", unit: "mg/kg" },
];

function latestDate(rows: readonly Date[]): string {
  let latest = -Infinity;
  for (const date of rows) {
    const time = date.getTime();
    if (Number.isFinite(time)) latest = Math.max(latest, time);
  }
  return Number.isFinite(latest) ? formatDateTime(new Date(latest)) : "-";
}

function roundMeasurement(value: number | null): number | string {
  if (value === null || !Number.isFinite(value)) return "-";
  const scaled = value * 10;
  return Number.isFinite(scaled) ? Math.round(scaled) / 10 : value;
}

export function summarizeSensorReadings(
  rows: readonly SensorRow[]
): ReportSummary {
  return {
    items: [
      { label: "Included readings", value: rows.length },
      {
        label: "Latest included reading",
        value: latestDate(rows.map((row) => row.recordedAt)),
      },
    ],
    table: {
      headers: ["Sensor", "Samples", "Minimum", "Average", "Maximum"],
      rows: SENSOR_FIELDS.map(({ field, label, unit }) => {
        let count = 0;
        let mean = 0;
        let min = Infinity;
        let max = -Infinity;
        for (const row of rows) {
          const value = row[field];
          if (value === null || !Number.isFinite(value)) continue;
          count++;
          // Equivalent to a running mean, but scale before subtracting so
          // opposite-sign finite extremes cannot overflow the difference.
          mean = count === 1
            ? value
            : mean + (value / count - mean / count);
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        return [
          `${label} (${unit})`,
          count,
          roundMeasurement(count ? min : null),
          roundMeasurement(count ? mean : null),
          roundMeasurement(count ? max : null),
        ];
      }),
    },
  };
}

type PlotRow = {
  status: string;
  readingCount: number;
  logCount: number;
  alertCount: number;
  openAlertCount: number;
};

export function summarizePlotPerformance(rows: readonly PlotRow[]): ReportSummary {
  const setup = new Set<string>(SETUP_PLOT_STATUSES);
  const operational = new Set<string>(OPERATIONAL_PLOT_STATUSES);
  const historical = new Set<string>(HISTORICAL_PLOT_STATUSES);
  return {
    items: [
      { label: "Plots represented", value: rows.length },
      { label: "Setup plots (current)", value: rows.filter((row) => setup.has(row.status)).length },
      { label: "Operational plots (current)", value: rows.filter((row) => operational.has(row.status)).length },
      { label: "Historical plots (current)", value: rows.filter((row) => historical.has(row.status)).length },
      { label: "Readings in selected range", value: rows.reduce((sum, row) => sum + row.readingCount, 0) },
      { label: "Growth logs in selected range", value: rows.reduce((sum, row) => sum + row.logCount, 0) },
      { label: "Alerts in selected range", value: rows.reduce((sum, row) => sum + row.alertCount, 0) },
      { label: "Current open alerts", value: rows.reduce((sum, row) => sum + row.openAlertCount, 0) },
    ],
  };
}

type GrowthRow = { createdAt: Date; imageCount: number };

export function summarizeGrowthLogs(rows: readonly GrowthRow[]): ReportSummary {
  return {
    items: [
      { label: "Logs included", value: rows.length },
      { label: "Logs with photos", value: rows.filter((row) => row.imageCount > 0).length },
      { label: "Latest included log", value: latestDate(rows.map((row) => row.createdAt)) },
    ],
  };
}

type AlertRow = { severity: string; resolved: boolean };

export function summarizeAlerts(rows: readonly AlertRow[]): ReportSummary {
  return {
    items: [
      { label: "Alerts included", value: rows.length },
      { label: "Open", value: rows.filter((row) => !row.resolved).length },
      { label: "Resolved", value: rows.filter((row) => row.resolved).length },
      { label: "Critical", value: rows.filter((row) => row.severity === "CRITICAL").length },
      { label: "Warning", value: rows.filter((row) => row.severity === "WARNING").length },
      { label: "Info", value: rows.filter((row) => row.severity === "INFO").length },
      { label: "Open critical", value: rows.filter((row) => row.severity === "CRITICAL" && !row.resolved).length },
    ],
  };
}

type ActivityRow = { timestamp: Date; eventType: string };

export function summarizeActivity(rows: readonly ActivityRow[]): ReportSummary {
  let earliest = Infinity;
  let latest = -Infinity;
  for (const row of rows) {
    const time = row.timestamp.getTime();
    if (!Number.isFinite(time)) continue;
    earliest = Math.min(earliest, time);
    latest = Math.max(latest, time);
  }
  const coverage = Number.isFinite(earliest)
    ? `${formatDateTime(new Date(earliest))} - ${formatDateTime(new Date(latest))}`
    : "No events included for the selected scope.";
  const types = new Map<string, number>();
  for (const row of rows) {
    types.set(row.eventType, (types.get(row.eventType) ?? 0) + 1);
  }
  return {
    items: [
      { label: "Events included", value: rows.length },
      { label: "Included date coverage", value: coverage },
    ],
    table: {
      headers: ["Included event type", "Included events"],
      rows: [...types.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => [type, count]),
    },
  };
}

type StudentRow = {
  plotsAssigned: number;
  observationsInRange: number;
  photoCount: number;
};

export function summarizeStudentActivity(rows: readonly StudentRow[]): ReportSummary {
  return {
    items: [
      { label: "Students represented", value: rows.length },
      { label: "Observations in selected range", value: rows.reduce((sum, row) => sum + row.observationsInRange, 0) },
      { label: "Photos in selected range", value: rows.reduce((sum, row) => sum + row.photoCount, 0) },
      { label: "Current active assignments", value: rows.reduce((sum, row) => sum + row.plotsAssigned, 0) },
    ],
  };
}
