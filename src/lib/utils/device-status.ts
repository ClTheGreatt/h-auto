/**
 * Threshold for considering a device offline.
 * A device is offline if its last sensor reading is older than this.
 *
 * Note: This threshold governs LIVE status display (Plot Detail, Devices page)
 * which is computed on every page load from lastSeenAt. The stored
 * Device.status column is only updated once per day by the cron job
 * (Vercel Hobby tier limitation). For end users, live status via this
 * utility is always accurate. The stored column matters mainly for
 * triggering DEVICE_OFFLINE alerts, which may be delayed up to 24 hours
 * on the Hobby tier.
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
