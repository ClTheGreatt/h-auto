import type {
  AlertSeverity,
  AlertType,
  CropStage,
  SensorReading,
} from "@prisma/client";
import {
  getThresholdStatus,
  type SensorReadingValues,
  type ThresholdEvaluation,
} from "@/lib/sensors/threshold-status";
import { isWithinLightEvaluationWindow } from "./light-evaluation";

export type ThresholdAlertType = Exclude<AlertType, "DEVICE_OFFLINE">;
export type ThresholdSensorField = keyof SensorReadingValues;

export type Violation = {
  type: ThresholdAlertType;
  severity: AlertSeverity;
  message: string;
  field: ThresholdSensorField;
  value: number;
  min: number;
  max: number;
};

type Check = {
  field: ThresholdSensorField;
  minField: keyof CropStage;
  maxField: keyof CropStage;
  lowType: ThresholdAlertType;
  highType: ThresholdAlertType;
  label: string;
  unit: string;
};

const CHECKS = [
  { field: "soilMoisture", minField: "minSoilMoisture", maxField: "maxSoilMoisture", lowType: "LOW_SOIL_MOISTURE", highType: "HIGH_SOIL_MOISTURE", label: "soil moisture", unit: "%" },
  { field: "temperature", minField: "minTemperature", maxField: "maxTemperature", lowType: "LOW_TEMPERATURE", highType: "HIGH_TEMPERATURE", label: "temperature", unit: "°C" },
  { field: "humidity", minField: "minHumidity", maxField: "maxHumidity", lowType: "LOW_HUMIDITY", highType: "HIGH_HUMIDITY", label: "humidity", unit: "%" },
  { field: "lightIntensity", minField: "minLightIntensity", maxField: "maxLightIntensity", lowType: "LOW_LIGHT", highType: "HIGH_LIGHT", label: "light intensity", unit: "lux" },
  { field: "nitrogen", minField: "minNitrogen", maxField: "maxNitrogen", lowType: "LOW_NITROGEN", highType: "HIGH_NITROGEN", label: "nitrogen", unit: "mg/kg" },
  { field: "phosphorus", minField: "minPhosphorus", maxField: "maxPhosphorus", lowType: "LOW_PHOSPHORUS", highType: "HIGH_PHOSPHORUS", label: "phosphorus", unit: "mg/kg" },
  { field: "potassium", minField: "minPotassium", maxField: "maxPotassium", lowType: "LOW_POTASSIUM", highType: "HIGH_POTASSIUM", label: "potassium", unit: "mg/kg" },
] as const satisfies readonly Check[];

export type ThresholdReading = Pick<SensorReading, ThresholdSensorField>;

export type CurrentSensorEvaluation = {
  status: ThresholdEvaluation | "not-evaluated";
  evaluated: boolean;
};

export type CurrentReadingEvaluation = {
  evaluatedSensorCount: number;
  sensors: Record<ThresholdSensorField, CurrentSensorEvaluation>;
  violations: Violation[];
  highestSeverity: AlertSeverity | null;
  evaluatedAlertTypes: Set<ThresholdAlertType>;
};

export type CurrentReadingCondition =
  | "CURRENT_CRITICAL"
  | "CURRENT_WARNING"
  | "CURRENT_IN_RANGE"
  | "NO_EVALUABLE_DATA";

function severityFor(deviation: number): AlertSeverity {
  return deviation > 0.2 ? "CRITICAL" : "WARNING";
}

/**
 * Authoritative current-reading policy shared by alert persistence and the
 * Dashboard. It owns threshold boundaries, severity, null/invalid handling,
 * and Manila daylight eligibility so those consumers cannot drift apart.
 */
export function evaluateCurrentReading(
  reading: ThresholdReading,
  stage: CropStage,
  recordedAt: Date
): CurrentReadingEvaluation {
  const sensors = {} as Record<
    ThresholdSensorField,
    CurrentSensorEvaluation
  >;
  const violations: Violation[] = [];
  const evaluatedAlertTypes = new Set<ThresholdAlertType>();
  let evaluatedSensorCount = 0;
  let highestSeverity: AlertSeverity | null = null;
  const evaluateLight = isWithinLightEvaluationWindow(recordedAt);

  for (const check of CHECKS) {
    const value = reading[check.field];
    if (
      value === null ||
      value === undefined ||
      (check.field === "lightIntensity" && !evaluateLight)
    ) {
      sensors[check.field] = { status: "not-evaluated", evaluated: false };
      continue;
    }

    const min = stage[check.minField] as number;
    const max = stage[check.maxField] as number;
    const status = getThresholdStatus(value, min, max);
    if (status === "invalid-range" || status === "invalid-reading") {
      sensors[check.field] = { status, evaluated: false };
      continue;
    }

    sensors[check.field] = { status, evaluated: true };
    evaluatedSensorCount++;
    evaluatedAlertTypes.add(check.lowType);
    evaluatedAlertTypes.add(check.highType);

    if (status === "optimal") continue;

    const isLow = status === "low";
    const deviation = isLow
      ? min === 0
        ? 1
        : (min - value) / min
      : max === 0
        ? 1
        : (value - max) / max;
    const severity = severityFor(deviation);
    if (severity === "CRITICAL" || highestSeverity === null) {
      highestSeverity = severity;
    }

    violations.push({
      type: isLow ? check.lowType : check.highType,
      severity,
      message: `${isLow ? "Low" : "High"} ${check.label}: ${value}${check.unit} (ideal ${min}-${max}${check.unit})`,
      field: check.field,
      value,
      min,
      max,
    });
  }

  return {
    evaluatedSensorCount,
    sensors,
    violations,
    highestSeverity,
    evaluatedAlertTypes,
  };
}

export function getCurrentReadingCondition(
  evaluation: CurrentReadingEvaluation | null
): CurrentReadingCondition {
  if (!evaluation || evaluation.evaluatedSensorCount === 0) {
    return "NO_EVALUABLE_DATA";
  }
  if (evaluation.highestSeverity === "CRITICAL") return "CURRENT_CRITICAL";
  if (evaluation.highestSeverity === "WARNING") return "CURRENT_WARNING";
  return "CURRENT_IN_RANGE";
}
