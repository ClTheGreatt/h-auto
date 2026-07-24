import type { CropPreset } from "./presets";

// Shape of a Crop + its ordered stages, as fetched for the Quick start
// dropdown's "Custom" group (see src/app/dashboard/crops/new/page.tsx).
type CustomPresetSource = {
  id: string;
  name: string;
  variety: string | null;
  daysToHarvest: number;
  description: string | null;
  cultivationGuide: string | null;
  stages: {
    name: string;
    durationDays: number;
    description: string | null;
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
  }[];
};

// Reshapes an admin-promoted Crop into the same CropPreset shape the 9
// built-in presets already use, so the form's existing handlePresetSelect
// logic works unchanged for both sources.
export function toCustomPreset(crop: CustomPresetSource): CropPreset {
  return {
    id: crop.id,
    displayName: crop.variety ? `${crop.name} (${crop.variety})` : crop.name,
    name: crop.name,
    daysToHarvest: crop.daysToHarvest,
    description: crop.description ?? "",
    cultivationGuide: crop.cultivationGuide ?? "",
    stages: crop.stages.map((s) => ({
      name: s.name,
      description: s.description ?? "",
      durationDays: s.durationDays,
      minSoilMoisture: s.minSoilMoisture,
      maxSoilMoisture: s.maxSoilMoisture,
      minTemperature: s.minTemperature,
      maxTemperature: s.maxTemperature,
      minHumidity: s.minHumidity,
      maxHumidity: s.maxHumidity,
      minLightIntensity: s.minLightIntensity,
      maxLightIntensity: s.maxLightIntensity,
      minNitrogen: s.minNitrogen,
      maxNitrogen: s.maxNitrogen,
      minPhosphorus: s.minPhosphorus,
      maxPhosphorus: s.maxPhosphorus,
      minPotassium: s.minPotassium,
      maxPotassium: s.maxPotassium,
    })),
  };
}
