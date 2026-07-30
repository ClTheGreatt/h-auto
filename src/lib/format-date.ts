/**
 * Centralized date formatting for the entire app.
 * Use these instead of inline `toLocaleDateString` or duplicated `timeAgo`.
 */

/**
 * Relative time. "5s ago" → "3m ago" → "2h ago" → "5d ago" → falls back to short date for >1 week.
 *
 * Use for: feed items, recent activity, "last updated" indicators.
 */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 0) return "just now"; // future timestamps (clock drift)
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(d);
}

/**
 * Human-readable age for an open alert, using one unit to avoid duplicate
 * relative-time copy such as "1d ago · open 1d".
 */
export function formatOpenAlertAge(
  date: Date | string | null | undefined,
  nowMs = Date.now()
): string {
  if (!date) return "—";
  const openedAtMs = new Date(date).getTime();
  if (Number.isNaN(openedAtMs)) return "—";

  const minutes = Math.max(0, Math.floor((nowMs - openedAtMs) / (60 * 1000)));
  if (minutes < 1) return "Opened just now";
  if (minutes < 60) {
    return `Open for ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Open for ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.floor(hours / 24);
  return `Open for ${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Short date: "Nov 17, 2025"
 *
 * Use for: lists, table cells, anywhere a compact date is needed.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Date + time: "Nov 17, 2025, 3:45 PM"
 *
 * Use for: detail pages, audit logs, exact event timestamps.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
