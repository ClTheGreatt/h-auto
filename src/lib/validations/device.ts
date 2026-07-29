import { z } from "zod";

export const deviceSchema = z.object({
  deviceCode: z.string().min(1, "Device code is required"),
  plotId: z.string().min(1, "Plot is required"),
  firmwareVersion: z.string().optional().or(z.literal("")),
});

export type DeviceFormValues = z.infer<typeof deviceSchema>;

export const sensorReadingSchema = z
  .object({
    soilMoisture: z.number().min(0).max(100).nullable().optional(),
    temperature: z.number().nullable().optional(),
    humidity: z.number().min(0).max(100).nullable().optional(),
    lightIntensity: z.number().min(0).nullable().optional(),
    nitrogen: z.number().min(0).nullable().optional(),
    phosphorus: z.number().min(0).nullable().optional(),
    potassium: z.number().min(0).nullable().optional(),
  })
  .refine(
    (reading) =>
      Object.values(reading).some(
        (value) => value !== null && value !== undefined
      ),
    { message: "At least one sensor measurement is required" }
  );

export type SensorReadingInput = z.infer<typeof sensorReadingSchema>;
