import type { AlertSeverity, AlertType, CropStage, SensorReading } from "@prisma/client";

export type Violation = {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  field: string;
  value: number;
  min: number;
  max: number;
};

type Check = {
  field: keyof SensorReading;
  minField: keyof CropStage;
  maxField: keyof CropStage;
  lowType: AlertType;
  highType: AlertType;
  label: string;
  unit: string;
};

const CHECKS: Check[] = [
  { field: "soilMoisture", minField: "minSoilMoisture", maxField: "maxSoilMoisture", lowType: "LOW_SOIL_MOISTURE", highType: "HIGH_SOIL_MOISTURE", label: "soil moisture", unit: "%" },
  { field: "temperature", minField: "minTemperature", maxField: "maxTemperature", lowType: "LOW_TEMPERATURE", highType: "HIGH_TEMPERATURE", label: "temperature", unit: "°C" },
  { field: "humidity", minField: "minHumidity", maxField: "maxHumidity", lowType: "LOW_HUMIDITY", highType: "HIGH_HUMIDITY", label: "humidity", unit: "%" },
  { field: "lightIntensity", minField: "minLightIntensity", maxField: "maxLightIntensity", lowType: "LOW_LIGHT", highType: "HIGH_LIGHT", label: "light intensity", unit: "lux" },
  { field: "nitrogen", minField: "minNitrogen", maxField: "maxNitrogen", lowType: "LOW_NITROGEN", highType: "HIGH_NITROGEN", label: "nitrogen", unit: "mg/kg" },
  { field: "phosphorus", minField: "minPhosphorus", maxField: "maxPhosphorus", lowType: "LOW_PHOSPHORUS", highType: "HIGH_PHOSPHORUS", label: "phosphorus", unit: "mg/kg" },
  { field: "potassium", minField: "minPotassium", maxField: "maxPotassium", lowType: "LOW_POTASSIUM", highType: "HIGH_POTASSIUM", label: "potassium", unit: "mg/kg" },
];

function severityFor(deviation: number): AlertSeverity {
  if (deviation > 0.2) return "CRITICAL";
  return "WARNING";
}

export function checkThresholds(
  reading: SensorReading,
  stage: CropStage
): Violation[] {
  const violations: Violation[] = [];

  for (const check of CHECKS) {
    const value = reading[check.field] as number | null;
    if (value == null) continue;

    const min = stage[check.minField] as number;
    const max = stage[check.maxField] as number;

    if (value < min) {
      const deviation = min === 0 ? 1 : (min - value) / min;
      violations.push({
        type: check.lowType,
        severity: severityFor(deviation),
        message: `Low ${check.label}: ${value}${check.unit} (ideal ${min}-${max}${check.unit})`,
        field: check.field as string,
        value,
        min,
        max,
      });
    } else if (value > max) {
      const deviation = max === 0 ? 1 : (value - max) / max;
      violations.push({
        type: check.highType,
        severity: severityFor(deviation),
        message: `High ${check.label}: ${value}${check.unit} (ideal ${min}-${max}${check.unit})`,
        field: check.field as string,
        value,
        min,
        max,
      });
    }
  }

  return violations;
}