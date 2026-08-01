import type { PlotStatus } from "@prisma/client";
import { OPERATIONAL_PLOT_STATUSES } from "@/lib/plots/lifecycle";

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
