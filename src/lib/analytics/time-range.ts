import { getRollingRange } from "@/lib/analytics/manila-dates";

export type TimeRange = "24h" | "7d" | "30d" | "all";

export const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

export function getDateFromRange(
  range: TimeRange,
  now: Date = new Date()
): Date | null {
  return getRollingRange(range, now)?.gte ?? null;
}

export function parseRange(raw: string | undefined): TimeRange {
  if (raw === "24h" || raw === "7d" || raw === "30d" || raw === "all") {
    return raw;
  }
  return "7d";
}

export function formatChartDate(date: Date, range: TimeRange): string {
  const d = new Date(date);
  if (range === "24h") {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
      timeZone: "Asia/Manila",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}
