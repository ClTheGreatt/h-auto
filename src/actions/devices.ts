"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { deviceSchema, type DeviceFormValues } from "@/lib/validations/device";
import { hashApiKey } from "@/lib/devices/hash-key";

function generateApiKey(): string {
  return "h-auto_" + randomBytes(24).toString("hex");
}

export async function createDevice(input: DeviceFormValues) {
  await requireAdmin();

  const parsed = deviceSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const existingCode = await prisma.device.findUnique({
    where: { deviceCode: parsed.data.deviceCode },
  });
  if (existingCode) return { error: "Device code already in use" };

  const plotHasDevice = await prisma.device.findUnique({
    where: { plotId: parsed.data.plotId },
  });
  if (plotHasDevice) return { error: "This plot already has a device" };

  const rawKey = generateApiKey();

  const device = await prisma.device.create({
    data: {
      deviceCode: parsed.data.deviceCode,
      plotId: parsed.data.plotId,
      apiKey: rawKey,
      apiKeyHash: hashApiKey(rawKey),
      firmwareVersion: parsed.data.firmwareVersion || null,
      status: "OFFLINE",
    },
  });

  revalidatePath("/dashboard/devices");
  return { success: true, deviceId: device.id, apiKey: device.apiKey };
}

export async function updateDevice(id: string, input: DeviceFormValues) {
  await requireAdmin();

  const parsed = deviceSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const codeConflict = await prisma.device.findFirst({
    where: { deviceCode: parsed.data.deviceCode, NOT: { id } },
  });
  if (codeConflict) return { error: "Device code already in use" };

  const plotConflict = await prisma.device.findFirst({
    where: { plotId: parsed.data.plotId, NOT: { id } },
  });
  if (plotConflict) return { error: "This plot already has another device" };

  await prisma.device.update({
    where: { id },
    data: {
      deviceCode: parsed.data.deviceCode,
      plotId: parsed.data.plotId,
      firmwareVersion: parsed.data.firmwareVersion || null,
    },
  });

  revalidatePath("/dashboard/devices");
  return { success: true };
}

export async function regenerateApiKey(id: string) {
  await requireAdmin();
  try {
    const newKey = generateApiKey();
    await prisma.device.update({
      where: { id },
      data: { apiKey: newKey, apiKeyHash: hashApiKey(newKey) },
    });
    revalidatePath("/dashboard/devices");
    return { success: true, apiKey: newKey };
  } catch (error) {
    console.error("regenerateApiKey error:", error);
    return { error: "Failed to regenerate API key. Please try again." };
  }
}

export async function deleteDevice(id: string) {
  await requireAdmin();
  try {
    await prisma.device.delete({ where: { id } });
    revalidatePath("/dashboard/devices");
    return { success: true };
  } catch (error) {
    console.error("deleteDevice error:", error);
    return { error: "Failed to delete device. It may have associated sensor readings." };
  }
}

export async function simulateReading(deviceId: string) {
  await requireAdmin();

  if (process.env.NEXT_PUBLIC_ENABLE_SIMULATION !== "true") {
    return { error: "Simulation is disabled" };
  }

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: {
      plot: {
        include: {
          currentStage: true,
        },
      },
    },
  });
  if (!device) return { error: "Device not found" };

  const stage = device.plot.currentStage;
  const rand = (min: number, max: number) =>
    Math.round((Math.random() * (max - min) + min) * 10) / 10;
  const drift = Math.random() < 0.3 ? 1.25 : 1.0; // 30% chance of out-of-range

  const reading = {
    soilMoisture: stage
      ? rand(stage.minSoilMoisture / drift, stage.maxSoilMoisture * drift)
      : rand(55, 80),
    temperature: stage
      ? rand(stage.minTemperature / drift, stage.maxTemperature * drift)
      : rand(20, 32),
    humidity: stage
      ? rand(stage.minHumidity / drift, stage.maxHumidity * drift)
      : rand(55, 85),
    lightIntensity: stage
      ? rand(stage.minLightIntensity / drift, stage.maxLightIntensity * drift)
      : rand(5000, 20000),
    nitrogen: stage
      ? rand(stage.minNitrogen / drift, stage.maxNitrogen * drift)
      : rand(40, 150),
    phosphorus: stage
      ? rand(stage.minPhosphorus / drift, stage.maxPhosphorus * drift)
      : rand(30, 80),
    potassium: stage
      ? rand(stage.minPotassium / drift, stage.maxPotassium * drift)
      : rand(60, 200),
  };

  const created = await prisma.sensorReading.create({
    data: {
      deviceId: device.id,
      plotId: device.plotId,
      ...reading,
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: { status: "ONLINE", lastSeenAt: new Date() },
  });

  // Run alert processing (awaited so UI sees the new alerts)
  const { processSensorReading } = await import("@/lib/alerts/processor");
  await processSensorReading(created.id);

  revalidatePath("/dashboard/devices");
  revalidatePath(`/dashboard/plots/${device.plotId}`);
  revalidatePath("/dashboard/alerts");
  return { success: true, reading };
}