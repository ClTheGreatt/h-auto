/**
 * Threshold for considering a device offline.
 * A device is offline if its last sensor reading is older than this.
 * Used for both live status display AND cron-based offline detection
 * (which triggers DEVICE_OFFLINE alerts).
 */
export const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Compute device online status live from lastSeenAt timestamp.
 * Prefer this over reading Device.status column, which is only updated
 * periodically by the offline-detection cron and can be stale.
 */
export function isDeviceOnline(
  lastSeenAt: Date | null | undefined
): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < OFFLINE_THRESHOLD_MS;
}
