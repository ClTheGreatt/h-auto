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
  // Where the ideal [min, max] band itself starts/ends on the 0-100 track.
  // Only a fixed 33.3%/66.7% when the lower buffer zone doesn't need
  // flooring (see domainMin below) — callers must position the tinted
  // "ideal" zone using these, not a hard-coded middle third.
  bandStartPercent: number;
  bandEndPercent: number;
};

// Maps a value onto a 0-100 track: a lower buffer zone, the ideal [min, max]
// band, and an upper buffer zone, each nominally one bandWidth wide. No
// sensor field can read below zero, so the lower buffer is floored at 0
// instead of going negative — a wide band (e.g. light: 3000-8000, bandWidth
// 5000) would otherwise get a domainMin of -2000, which made an extreme-low
// reading like 0 lux land mid-track (~13%) instead of at the true bottom of
// the physically possible range. Flooring makes the domain asymmetric, so
// the band's own position on the track is no longer always 33.3%/66.7% —
// callers must use bandStartPercent/bandEndPercent, not a fixed middle third.
export function getBarPosition(
  value: number,
  min: number,
  max: number
): BarPosition {
  const bandWidth = max - min;
  if (bandWidth === 0) {
    return { percent: 50, clamped: null, bandStartPercent: 50, bandEndPercent: 50 };
  }

  const domainMin = Math.max(0, min - bandWidth);
  const domainMax = max + bandWidth;
  const domainSpan = domainMax - domainMin;

  const bandStartPercent = ((min - domainMin) / domainSpan) * 100;
  const bandEndPercent = ((max - domainMin) / domainSpan) * 100;

  if (value < domainMin) {
    return { percent: 0, clamped: "low", bandStartPercent, bandEndPercent };
  }
  if (value > domainMax) {
    return { percent: 100, clamped: "high", bandStartPercent, bandEndPercent };
  }

  const percent = ((value - domainMin) / domainSpan) * 100;
  return { percent, clamped: null, bandStartPercent, bandEndPercent };
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
