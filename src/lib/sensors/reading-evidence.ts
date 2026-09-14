import type { DeviceFreshness } from "@/lib/utils/device-status";

export function isCurrentSensorEvidence({
  readingDeviceId,
  linkedDeviceId,
  readingFreshness,
  deviceFreshness,
  devicePaused,
}: {
  readingDeviceId: string | null;
  linkedDeviceId: string | null;
  readingFreshness: DeviceFreshness;
  deviceFreshness: DeviceFreshness;
  devicePaused: boolean;
}): boolean {
  return (
    readingDeviceId !== null &&
    linkedDeviceId !== null &&
    readingDeviceId === linkedDeviceId &&
    readingFreshness.state === "FRESH" &&
    deviceFreshness.state === "FRESH" &&
    !devicePaused
  );
}

export function isHistoricalSensorEvidence({
  readingRecordedAt,
  currentEvidence,
  devicePaused,
}: {
  readingRecordedAt: Date | null;
  currentEvidence: boolean;
  devicePaused: boolean;
}): boolean {
  return readingRecordedAt !== null && (!currentEvidence || devicePaused);
}
