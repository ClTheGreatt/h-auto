import { z } from "zod";
import { isValidThresholdRange } from "@/lib/sensors/threshold-status";

const stageFields = z.object({
  // Present for a stage that already exists in the DB (round-tripped from
  // EditCropPage's defaultValues), absent for one newly appended in the
  // form. Named dbId, not id — react-hook-form's useFieldArray injects its
  // own generated `id` per row and strips any field literally called `id`.
  dbId: z.string().optional(),
  name: z.string().min(1, "Stage name is required"),
  orderIndex: z.number().int().min(0),
  durationDays: z.number().int().positive("Duration must be at least 1 day"),
  description: z.string().optional().or(z.literal("")),
  minSoilMoisture: z.number().min(0).max(100),
  maxSoilMoisture: z.number().min(0).max(100),
  minTemperature: z.number(),
  maxTemperature: z.number(),
  minHumidity: z.number().min(0).max(100),
  maxHumidity: z.number().min(0).max(100),
  minLightIntensity: z.number().min(0),
  maxLightIntensity: z.number().min(0),
  minNitrogen: z.number().min(0),
  maxNitrogen: z.number().min(0),
  minPhosphorus: z.number().min(0),
  maxPhosphorus: z.number().min(0),
  minPotassium: z.number().min(0),
  maxPotassium: z.number().min(0),
});

const THRESHOLD_RANGE_PAIRS = [
  ["minSoilMoisture", "maxSoilMoisture"],
  ["minTemperature", "maxTemperature"],
  ["minHumidity", "maxHumidity"],
  ["minLightIntensity", "maxLightIntensity"],
  ["minNitrogen", "maxNitrogen"],
  ["minPhosphorus", "maxPhosphorus"],
  ["minPotassium", "maxPotassium"],
] as const satisfies ReadonlyArray<
  readonly [keyof z.infer<typeof stageFields>, keyof z.infer<typeof stageFields>]
>;

const stageSchema = stageFields.superRefine((stage, context) => {
  for (const [minField, maxField] of THRESHOLD_RANGE_PAIRS) {
    if (!isValidThresholdRange(stage[minField], stage[maxField])) {
      context.addIssue({
        code: "custom",
        path: [maxField],
        message: "Minimum must be lower than maximum.",
      });
    }
  }
});

export const cropSchema = z.object({
  name: z.string().min(1, "Crop name is required"),
  variety: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  daysToHarvest: z.number().int().positive("Days to harvest must be positive"),
  cultivationGuide: z.string().optional().or(z.literal("")),
  stages: z.array(stageSchema).min(1, "At least one stage is required"),
});

export type CropFormValues = z.infer<typeof cropSchema>;
