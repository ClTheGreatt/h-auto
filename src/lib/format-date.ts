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
 * Short date: "Nov 17, 2025"
 *
 * Use for: lists, table cells, anywhere a compact date is needed.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
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
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Time only: "3:45 PM"
 *
 * Use for: same-day timeline items where the date is implied.
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * ISO short date: "2025-11-17"
 *
 * Use for: CSV exports, filenames, date input fields, anywhere a
 * sortable / machine-readable date is needed.
 */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}