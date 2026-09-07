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
//
// RETIRED is NOT dead. It remains a valid DeviceStatus enum value in the
// schema, it is still one of device-offline.ts's EXCLUDED_DEVICE_STATUSES
// (so a RETIRED device is still exempt from offline alerting), and every
// read path still renders it — DEVICE_STATUS_LABEL below still maps it, and
// the dashboard/plot pages still treat it as "out of automatic tracking"
// alongside MAINTENANCE. It is withheld from this list for one reason only:
// this deployment has no use for it. The device API key lives in the
// database row rather than on the hardware, so a broken board is replaced
// by reflashing the same key, not by retiring the device.
//
// One implicit consequence of withholding it here: actions/devices.ts's
// isAllowedStatusTransition reads this same constant as its enforcement
// boundary, so a hand-crafted request submitting RETIRED is now silently
// ignored (the status is left untouched) rather than applied. That is
// intended, but it happens here rather than at the guard — so if RETIRED
// ever needs to be settable again, adding it back to this array is the
// whole change.
export const ADMIN_SETTABLE_DEVICE_STATUSES: DeviceStatus[] = ["MAINTENANCE"];

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

// Display labels for device freshness. "Online" rather than "Fresh":
// the four states form one plain-language vocabulary a non-technical
// reader can rank — Online / Delayed / Offline / Never reported.
export const DEVICE_FRESHNESS_LABEL: Record<DeviceFreshnessState, string> = {
  FRESH: "Online",
  STALE: "Delayed",
  OFFLINE: "Offline",
  NEVER_REPORTED: "Never reported",
};

// Display labels for the administrative device status. Rendering the
// raw Prisma enum produces all-caps text next to title-case labels.
export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  MAINTENANCE: "Powered off",
  RETIRED: "Retired",
};
