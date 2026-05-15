import { z } from "zod";

export const deviceSchema = z.object({
  deviceCode: z.string().min(1, "Device code is required"),
  plotId: z.string().min(1, "Plot is required"),
  firmwareVersion: z.string().optional().or(z.literal("")),
});

export type DeviceFormValues = z.infer<typeof deviceSchema>;