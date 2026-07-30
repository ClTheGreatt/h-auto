// Shared by every "reading vs. ideal range" display site (currently
// latest-readings.tsx; see also src/lib/alerts/threshold-checker.ts and
// src/lib/analytics/aggregator.ts, which independently re-derive the same
// per-field min/max comparison for alert generation and the health gauge
// respectively — this file does NOT replace those, it's for new UI-side
// consumers so a fourth/fifth copy of the same field list never needs to
// exist).

export type SensorType =
  | "SOIL_MOISTURE"
  | "TEMPERATURE"
  | "HUMIDITY"
  | "LIGHT"
  | "NITROGEN"
  | "PHOSPHORUS"
  | "POTASSIUM";

export type ThresholdStatus = "low" | "optimal" | "high";
export type ThresholdEvaluation =
  | ThresholdStatus
  | "invalid-range"
  | "invalid-reading";

export function isValidThresholdRange(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min < max;
}

export function getThresholdStatus(
  value: number,
  min: number,
  max: number
): ThresholdEvaluation {
  if (!isValidThresholdRange(min, max)) return "invalid-range";
  if (!Number.isFinite(value)) return "invalid-reading";
  if (value < min) return "low";
  if (value > max) return "high";
  return "optimal";
}

export type BarPosition = {
  percent: number;
  clamped: "low" | "high" | null;
  // Where the ideal [min, max] band itself starts/ends on the 0-100 track.
  // Only a fixed 33.3%/66.7% when the lower buffer zone doesn't need
  // flooring (see domainMin below) — callers must position the tinted
  // "ideal" zone using these, not a hard-coded middle third.
  bandStartPercent: number;
  bandEndPercent: number;
};

// Maps a value onto a 0-100 track with one ideal-band width of visual buffer
// on either side. Temperature may extend below zero. Every other sensor has
// a non-negative physical domain, so its lower visual buffer is floored at 0.
// That flooring can make the domain asymmetric, so callers must use the
// returned band positions rather than assuming a fixed middle third.
export function getBarPosition(
  value: number,
  min: number,
  max: number,
  sensorType: SensorType
): BarPosition | null {
  if (!isValidThresholdRange(min, max) || !Number.isFinite(value)) return null;

  // Normalize before calculating the buffered domain. This keeps arithmetic
  // finite even for unusually large but finite stored thresholds.
  const scale = Math.max(1, Math.abs(min), Math.abs(max));
  const normalizedValue = value / scale;
  const normalizedMin = min / scale;
  const normalizedMax = max / scale;
  const bandWidth = normalizedMax - normalizedMin;
  const allowNegativeDomain = sensorType === "TEMPERATURE";
  const domainMin = allowNegativeDomain
    ? normalizedMin - bandWidth
    : Math.max(0, normalizedMin - bandWidth);
  const domainMax = normalizedMax + bandWidth;
  const domainSpan = domainMax - domainMin;

  if (
    !Number.isFinite(domainSpan) ||
    domainSpan <= 0 ||
    !Number.isFinite(normalizedValue)
  ) {
    return null;
  }

  const clampPercent = (percent: number) =>
    Math.min(100, Math.max(0, percent));
  const bandStartPercent = clampPercent(
    ((normalizedMin - domainMin) / domainSpan) * 100
  );
  const bandEndPercent = clampPercent(
    ((normalizedMax - domainMin) / domainSpan) * 100
  );

  if (normalizedValue < domainMin) {
    return { percent: 0, clamped: "low", bandStartPercent, bandEndPercent };
  }
  if (normalizedValue > domainMax) {
    return { percent: 100, clamped: "high", bandStartPercent, bandEndPercent };
  }

  const percent = clampPercent(
    ((normalizedValue - domainMin) / domainSpan) * 100
  );
  return { percent, clamped: null, bandStartPercent, bandEndPercent };
}

const SENSOR_UNIT_SUFFIX: Record<SensorType, string> = {
  SOIL_MOISTURE: "%",
  TEMPERATURE: "°C",
  HUMIDITY: "%",
  LIGHT: " lux",
  NITROGEN: " mg/kg",
  PHOSPHORUS: " mg/kg",
  POTASSIUM: " mg/kg",
};

export function formatSensorValue(
  value: number,
  sensorType: SensorType
): string {
  if (!Number.isFinite(value)) return "Invalid reading";
  return `${value}${SENSOR_UNIT_SUFFIX[sensorType]}`;
}

export function formatSensorRange(
  min: number,
  max: number,
  sensorType: SensorType
): string {
  return `${min}–${max}${SENSOR_UNIT_SUFFIX[sensorType]}`;
}

// The 7 raw sensor fields (SensorReading) and their corresponding min/max
// fields on CropStage. Declared as real types (not `any`/string) so indexing
// a reading or stage object by these keys stays fully typed for callers.
export type SensorReadingValues = {
  soilMoisture: number | null;
  temperature: number | null;
  humidity: number | null;
  lightIntensity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
};

export type StageThresholds = {
  minSoilMoisture: number;
  maxSoilMoisture: number;
  minTemperature: number;
  maxTemperature: number;
  minHumidity: number;
  maxHumidity: number;
  minLightIntensity: number;
  maxLightIntensity: number;
  minNitrogen: number;
  maxNitrogen: number;
  minPhosphorus: number;
  maxPhosphorus: number;
  minPotassium: number;
  maxPotassium: number;
};

export type SensorFieldDef = {
  key: keyof SensorReadingValues;
  label: string;
  type: SensorType;
  minField: keyof StageThresholds;
  maxField: keyof StageThresholds;
};

export const SENSOR_FIELDS: SensorFieldDef[] = [
  { key: "soilMoisture", label: "Soil moisture", type: "SOIL_MOISTURE", minField: "minSoilMoisture", maxField: "maxSoilMoisture" },
  { key: "temperature", label: "Temperature", type: "TEMPERATURE", minField: "minTemperature", maxField: "maxTemperature" },
  { key: "humidity", label: "Humidity", type: "HUMIDITY", minField: "minHumidity", maxField: "maxHumidity" },
  { key: "lightIntensity", label: "Light intensity", type: "LIGHT", minField: "minLightIntensity", maxField: "maxLightIntensity" },
  { key: "nitrogen", label: "Nitrogen", type: "NITROGEN", minField: "minNitrogen", maxField: "maxNitrogen" },
  { key: "phosphorus", label: "Phosphorus", type: "PHOSPHORUS", minField: "minPhosphorus", maxField: "maxPhosphorus" },
  { key: "potassium", label: "Potassium", type: "POTASSIUM", minField: "minPotassium", maxField: "maxPotassium" },
];
