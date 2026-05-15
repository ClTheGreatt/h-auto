import { z } from "zod";

export const plotSchema = z.object({
  name: z.string().min(1, "Plot name is required"),
  location: z.string().optional().or(z.literal("")),
  sizeSqm: z.number().nonnegative().nullable().optional(),
  cropId: z.string().nullable().optional(),
  currentStageId: z.string().nullable().optional(),
  plantingDate: z.string().optional().or(z.literal("")),
  expectedHarvest: z.string().optional().or(z.literal("")),
  status: z.enum([
    "PREPARING",
    "PLANTED",
    "GROWING",
    "READY_FOR_HARVEST",
    "HARVESTED",
    "FALLOW",
  ]),
});

export type PlotFormValues = z.infer<typeof plotSchema>;

export const assignmentSchema = z.object({
  plotId: z.string().min(1),
  studentId: z.string().min(1),
  notes: z.string().optional().or(z.literal("")),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;