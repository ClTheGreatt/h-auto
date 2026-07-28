// Shared by every "reading vs. ideal range" display site (currently
// latest-readings.tsx; see also src/lib/alerts/threshold-checker.ts and
// src/lib/analytics/aggregator.ts, which independently re-derive the same
// per-field min/max comparison for alert generation and the health gauge
// respectively — this file does NOT replace those, it's for new UI-side
// consumers so a fourth/fifth copy of the same field list never needs to
// exist).

export type ThresholdStatus = "low" | "optimal" | "high";

export function getThresholdStatus(
  value: number,
  min: number,
  max: number
): ThresholdStatus {
  if (value < min) return "low";
  if (value > max) return "high";
  return "optimal";
}

export type BarPosition = {
  percent: number;
  clamped: "low" | "high" | null;
};

// Maps a value onto a 0-100 track where the ideal [min, max] band always
// occupies the middle third (domainMin..min..max..domainMax, each segment
// exactly one bandWidth wide) — so a consumer rendering the middle third as
// the tinted "ideal" zone automatically lines up with this percent.
export function getBarPosition(
  value: number,
  min: number,
  max: number
): BarPosition {
  const bandWidth = max - min;
  if (bandWidth === 0) {
    return { percent: 50, clamped: null };
  }

  const domainMin = min - bandWidth;
  const domainMax = max + bandWidth;

  if (value < domainMin) return { percent: 0, clamped: "low" };
  if (value > domainMax) return { percent: 100, clamped: "high" };

  const percent = ((value - domainMin) / (domainMax - domainMin)) * 100;
  return { percent, clamped: null };
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
  unit: string;
  minField: keyof StageThresholds;
  maxField: keyof StageThresholds;
};

export const SENSOR_FIELDS: SensorFieldDef[] = [
  { key: "soilMoisture", label: "Soil moisture", unit: "%", minField: "minSoilMoisture", maxField: "maxSoilMoisture" },
  { key: "temperature", label: "Temperature", unit: "°C", minField: "minTemperature", maxField: "maxTemperature" },
  { key: "humidity", label: "Humidity", unit: "%", minField: "minHumidity", maxField: "maxHumidity" },
  { key: "lightIntensity", label: "Light intensity", unit: "lux", minField: "minLightIntensity", maxField: "maxLightIntensity" },
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg", minField: "minNitrogen", maxField: "maxNitrogen" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg", minField: "minPhosphorus", maxField: "maxPhosphorus" },
  { key: "potassium", label: "Potassium", unit: "mg/kg", minField: "minPotassium", maxField: "maxPotassium" },
];
