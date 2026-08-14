import type { DeviceStatus, PlotStatus } from "@prisma/client";
import { OPERATIONAL_PLOT_STATUSES } from "@/lib/plots/lifecycle";

// Statuses an admin can declare directly via the Edit Device form — a device
// deliberately taken out of service, with no companion timestamp field to
// keep in sync. ONLINE/OFFLINE are deliberately excluded: they're
// system-driven (ingest sets ONLINE on every accepted reading; the
// offline-detection cron sets OFFLINE after DEVICE_OFFLINE_THRESHOLD_MS of
// silence — see src/lib/alerts/device-offline.ts), so a form control
// letting an admin hand-set either would just get overwritten by the next
// heartbeat or scan, or falsely claim liveness with no evidence behind it.
// These happen to be the same two values device-offline.ts's own
// EXCLUDED_DEVICE_STATUSES excludes from offline-alert eligibility — the
// same concept (a device deliberately out of live operation), declared
// independently here rather than imported, to keep this form-facing change
// from touching that already-tested alert-scan module.
export const ADMIN_SETTABLE_DEVICE_STATUSES: DeviceStatus[] = [
  "MAINTENANCE",
  "RETIRED",
];

export const EXPECTED_REPORTING_INTERVAL_MS = 5 * 60 * 1000;
export const DEVICE_STALE_THRESHOLD_MS = 15 * 60 * 1000;
export const DEVICE_OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;
export const ACTIVE_MONITORING_PLOT_STATUSES: PlotStatus[] = [
  ...OPERATIONAL_PLOT_STATUSES,
];

export type DeviceFreshnessState =
  | "FRESH"
  | "STALE"
  | "OFFLINE"
  | "NEVER_REPORTED";

export type DeviceFreshness = {
  state: DeviceFreshnessState;
  elapsedMs: number | null;
};

/**
 * Derive runtime device freshness from lastSeenAt rather than stored status.
 * Passing `now` makes boundary behavior deterministic for callers and tests.
 */
export function getDeviceFreshness(
  lastSeenAt: Date | null | undefined,
  now: Date | number = new Date()
): DeviceFreshness {
  if (!lastSeenAt) {
    return { state: "NEVER_REPORTED", elapsedMs: null };
  }

  const lastSeenMs = lastSeenAt.getTime();
  const nowMs = typeof now === "number" ? now : now.getTime();
  if (!Number.isFinite(lastSeenMs) || !Number.isFinite(nowMs)) {
    return { state: "NEVER_REPORTED", elapsedMs: null };
  }

  const elapsedMs = Math.max(0, nowMs - lastSeenMs);
  if (elapsedMs >= DEVICE_OFFLINE_THRESHOLD_MS) {
    return { state: "OFFLINE", elapsedMs };
  }
  if (elapsedMs >= DEVICE_STALE_THRESHOLD_MS) {
    return { state: "STALE", elapsedMs };
  }
  return { state: "FRESH", elapsedMs };
}

/**
 * Compatibility helper: stale devices remain online until the 30-minute
 * offline boundary, matching the existing mobile `deviceOnline` contract.
 */
export function isDeviceOnline(
  lastSeenAt: Date | null | undefined,
  now?: Date | number
): boolean {
  const state = getDeviceFreshness(lastSeenAt, now).state;
  return state === "FRESH" || state === "STALE";
}
