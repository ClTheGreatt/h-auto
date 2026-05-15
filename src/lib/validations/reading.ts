import { z } from "zod";

export const sensorReadingSchema = z.object({
  soilMoisture: z.number().min(0).max(100).optional(),
  temperature: z.number().min(-50).max(80).optional(),
  humidity: z.number().min(0).max(100).optional(),
  lightIntensity: z.number().min(0).optional(),
  nitrogen: z.number().min(0).optional(),
  phosphorus: z.number().min(0).optional(),
  potassium: z.number().min(0).optional(),
  recordedAt: z.string().optional(),
});

export type SensorReadingInput = z.infer<typeof sensorReadingSchema>;