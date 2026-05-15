import { z } from "zod";

export const growthLogSchema = z.object({
  stageId: z.string().optional().or(z.literal("")),
  plantHeightCm: z.number().nonnegative().nullable().optional(),
  leafCount: z.number().int().nonnegative().nullable().optional(),
  observations: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  images: z.array(z.string().url()).max(5, "Maximum 5 images per log"),
});

export type GrowthLogFormValues = z.infer<typeof growthLogSchema>;