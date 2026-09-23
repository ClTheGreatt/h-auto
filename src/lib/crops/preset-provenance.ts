import type { CropPreset } from "./presets";
import type { CropFormValues } from "../validations/crop";

export const NONE_PRESET_ID = "__none__";

export type PresetSelectionKind = "BUILT_IN" | "CUSTOM" | "MANUAL";

export type ThresholdField =
  | "SoilMoisture"
  | "Temperature"
  | "Humidity"
  | "LightIntensity"
  | "Nitrogen"
  | "Phosphorus"
  | "Potassium";

export const PARAMETER_BASIS: Record<
  ThresholdField,
  { label: string; explanation: string }
> = {
  Temperature: {
    label: "Configurable monitoring range",
    explanation:
      "This H-Auto monitoring range may be adjusted for crop variety, growth stage, sensor calibration, and local conditions.",
  },
  Humidity: {
    label: "Configurable monitoring range",
    explanation:
      "This H-Auto monitoring range may be adjusted for crop variety, growth stage, sensor calibration, and local conditions.",
  },
  SoilMoisture: {
    label: "Field-adjustable",
    explanation:
      "Soil-moisture readings depend on soil properties, placement, and sensor calibration.",
  },
  LightIntensity: {
    label: "Monitoring reference",
    explanation:
      "This initial monitoring band may be adjusted for site and growing conditions.",
  },
  Nitrogen: {
    label: "Soil-test adjustable",
    explanation:
      "Available nutrient readings depend on the soil-test method, soil properties, crop stage, and fertilizer management.",
  },
  Phosphorus: {
    label: "Soil-test adjustable",
    explanation:
      "Available nutrient readings depend on the soil-test method, soil properties, crop stage, and fertilizer management.",
  },
  Potassium: {
    label: "Soil-test adjustable",
    explanation:
      "Available nutrient readings depend on the soil-test method, soil properties, crop stage, and fertilizer management.",
  },
};

export function getPresetSelectionKind(
  preset: CropPreset | null
): PresetSelectionKind {
  if (!preset) return "MANUAL";
  return preset.provenance?.kind === "REFERENCE_REVIEWED"
    ? "BUILT_IN"
    : "CUSTOM";
}

export function resolvePresetSelection(
  presetId: string,
  builtInPresets: CropPreset[],
  customPresets: CropPreset[]
): CropPreset | null {
  if (presetId === NONE_PRESET_ID) return null;
  return (
    builtInPresets.find((preset) => preset.id === presetId) ??
    customPresets.find((preset) => preset.id === presetId) ??
    null
  );
}

export function getPresetLoadValues(
  preset: CropPreset
): Pick<
  CropFormValues,
  "name" | "daysToHarvest" | "description" | "cultivationGuide" | "stages"
> {
  return {
    name: preset.name,
    daysToHarvest: preset.daysToHarvest,
    description: preset.description,
    cultivationGuide: preset.cultivationGuide,
    stages: preset.stages.map((stage, orderIndex) => ({
      ...stage,
      expectedAppearance: stage.expectedAppearance ?? "",
      observableSigns: stage.observableSigns ?? [],
      facultyGuidance: stage.facultyGuidance ?? "",
      orderIndex,
    })),
  };
}

export function isSafeReferenceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function showsPresetQuickStart(mode: "create" | "edit"): boolean {
  return mode === "create";
}
