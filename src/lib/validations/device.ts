import { z } from "zod";

export const deviceSchema = z.object({
  deviceCode: z.string().min(1, "Device code is required"),
  plotId: z.string().min(1, "Plot is required"),
  firmwareVersion: z.string().optional().or(z.literal("")),
  // Present only in edit mode (see device-form.tsx) — createDevice always
  // sets OFFLINE regardless of what's submitted, so create mode never
  // populates this. Optional rather than defaulted: updateDevice treats an
  // absent/disallowed value as "leave the current status alone."
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "RETIRED"]).optional(),
});

export type DeviceFormValues = z.infer<typeof deviceSchema>;

// -5 to 60°C — generous headroom for a Philippines-sited deployment (ambient
// realistically ~18-40°C, with buffer for direct sun on a sensor housing or
// a cold boot reading) while still catching a garbage/typo value like
// 99999. Matches minTemperature/maxTemperature in validations/crop.ts
// exactly, so any storable reading can always be expressed by some
// threshold pair and vice versa.
const TEMPERATURE_MIN = -5;
const TEMPERATURE_MAX = 60;

export const sensorReadingSchema = z
  .object({
    soilMoisture: z.number().min(0).max(100).nullable().optional(),
    temperature: z
      .number()
      .min(TEMPERATURE_MIN)
      .max(TEMPERATURE_MAX)
      .nullable()
      .optional(),
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
