import type { SensorReading, CropStage } from "@prisma/client";

const SENSOR_CHECKS = [
  { field: "soilMoisture", minField: "minSoilMoisture", maxField: "maxSoilMoisture" },
  { field: "temperature", minField: "minTemperature", maxField: "maxTemperature" },
  { field: "humidity", minField: "minHumidity", maxField: "maxHumidity" },
  { field: "lightIntensity", minField: "minLightIntensity", maxField: "maxLightIntensity" },
  { field: "nitrogen", minField: "minNitrogen", maxField: "maxNitrogen" },
  { field: "phosphorus", minField: "minPhosphorus", maxField: "maxPhosphorus" },
  { field: "potassium", minField: "minPotassium", maxField: "maxPotassium" },
] as const;

/**
 * Calculate the percentage of sensor values that fall within optimal range
 * for the given stage's thresholds, or null when evaluation is unavailable.
 */
export function calculateOptimalPercent(
  readings: SensorReading[],
  stage: CropStage | null
): number | null {
  if (readings.length === 0 || !stage) return null;

  let totalChecks = 0;
  let optimalChecks = 0;

  for (const reading of readings) {
    for (const check of SENSOR_CHECKS) {
      const value = reading[check.field] as number | null;
      if (value == null) continue;

      const min = stage[check.minField] as number;
      const max = stage[check.maxField] as number;

      totalChecks++;
      if (value >= min && value <= max) {
        optimalChecks++;
      }
    }
  }

  return totalChecks === 0 ? null : (optimalChecks / totalChecks) * 100;
}

/**
 * Reduce a long list of readings to a manageable number of points
 * by sampling evenly while preserving chronological endpoints.
 */
export function downsample<T>(arr: T[], maxPoints: number): T[] {
  const limit = Math.floor(maxPoints);
  if (limit <= 0) return [];
  if (arr.length <= limit) return arr;
  if (limit === 1) return [arr[arr.length - 1]];

  const result: T[] = [];
  const lastIndex = arr.length - 1;
  for (let i = 0; i < limit; i++) {
    const index = Math.round((i * lastIndex) / (limit - 1));
    result.push(arr[index]);
  }
  return result;
}

export const ALERT_TYPE_LABELS: Record<string, string> = {
  LOW_SOIL_MOISTURE: "Low soil moisture",
  HIGH_SOIL_MOISTURE: "High soil moisture",
  LOW_TEMPERATURE: "Low temperature",
  HIGH_TEMPERATURE: "High temperature",
  LOW_HUMIDITY: "Low humidity",
  HIGH_HUMIDITY: "High humidity",
  LOW_LIGHT: "Low light",
  HIGH_LIGHT: "High light",
  LOW_NITROGEN: "Low nitrogen",
  HIGH_NITROGEN: "High nitrogen",
  LOW_PHOSPHORUS: "Low phosphorus",
  HIGH_PHOSPHORUS: "High phosphorus",
  LOW_POTASSIUM: "Low potassium",
  HIGH_POTASSIUM: "High potassium",
};
