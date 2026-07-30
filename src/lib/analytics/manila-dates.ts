export const MANILA_TIME_ZONE = "Asia/Manila";
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const MANILA_UTC_OFFSET_MS = 8 * HOUR_MS;

export type ManilaDateRange = {
  gte: Date;
  lt: Date;
};

export type ParsedYearMonth = {
  value: string;
  year: number;
  month: number;
};

export type RollingRange = "24h" | "7d" | "30d" | "all";

export type OptionalYearMonthResult =
  | { kind: "absent" }
  | { kind: "valid"; month: ParsedYearMonth }
  | { kind: "invalid" };

function getTimestamp(value: Date | number): number {
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(timestamp)) {
    throw new RangeError("Invalid timestamp");
  }
  return timestamp;
}

function getUtcWallClockTimestamp(
  year: number,
  monthIndex: number,
  day: number
): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date.getTime();
}

function getManilaBoundary(
  year: number,
  monthIndex: number,
  day: number
): Date {
  return new Date(
    getUtcWallClockTimestamp(year, monthIndex, day) - MANILA_UTC_OFFSET_MS
  );
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

export function parseStrictYearMonth(
  value: string | null | undefined
): ParsedYearMonth | null {
  if (typeof value !== "string") return null;

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;

  return {
    value,
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

export function parseApiMonthValues(
  values: readonly string[]
): OptionalYearMonthResult {
  if (values.length === 0) return { kind: "absent" };
  if (values.length !== 1) return { kind: "invalid" };

  const month = parseStrictYearMonth(values[0]);
  return month ? { kind: "valid", month } : { kind: "invalid" };
}

export function parseWebMonthParam(
  value: string | string[] | undefined
): OptionalYearMonthResult {
  if (value === undefined) return { kind: "absent" };
  if (typeof value !== "string") return { kind: "invalid" };

  const month = parseStrictYearMonth(value);
  return month ? { kind: "valid", month } : { kind: "invalid" };
}

export function getManilaMonthRange(
  year: number,
  month: number
): ManilaDateRange {
  if (
    !Number.isInteger(year) ||
    year < 0 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError("Invalid year or month");
  }

  return {
    gte: getManilaBoundary(year, month - 1, 1),
    lt: getManilaBoundary(year, month, 1),
  };
}

export function getManilaDateKey(value: Date | number): string {
  const manilaTime = new Date(getTimestamp(value) + MANILA_UTC_OFFSET_MS);
  return formatDateKey(
    manilaTime.getUTCFullYear(),
    manilaTime.getUTCMonth() + 1,
    manilaTime.getUTCDate()
  );
}

export function getManilaMonthKey(value: Date | number): string {
  return getManilaDateKey(value).slice(0, 7);
}

export function parseStrictManilaDateKey(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;

  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(
    value
  );
  if (!match) return null;

  const start = getManilaBoundary(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return getManilaDateKey(start) === value ? value : null;
}

export function getManilaDayRange(value: Date | number): ManilaDateRange;
export function getManilaDayRange(value: string): ManilaDateRange | null;
export function getManilaDayRange(
  value: Date | number | string
): ManilaDateRange | null {
  const dateKey =
    typeof value === "string" ? parseStrictManilaDateKey(value) : getManilaDateKey(value);
  if (!dateKey) return null;

  const [year, month, day] = dateKey.split("-").map(Number);
  return {
    gte: getManilaBoundary(year, month - 1, day),
    lt: getManilaBoundary(year, month - 1, day + 1),
  };
}

export function getCurrentManilaDayRange(
  now: Date = new Date()
): ManilaDateRange {
  return getManilaDayRange(now);
}

export function getRollingRange(
  range: RollingRange,
  now: Date = new Date()
): { gte: Date } | null {
  const nowMs = getTimestamp(now);
  switch (range) {
    case "24h":
      return { gte: new Date(nowMs - DAY_MS) };
    case "7d":
      return { gte: new Date(nowMs - 7 * DAY_MS) };
    case "30d":
      return { gte: new Date(nowMs - 30 * DAY_MS) };
    case "all":
      return null;
  }
}

export function getAnalyticsDateFilter(
  month: ParsedYearMonth | null,
  range: RollingRange,
  now?: Date
): ManilaDateRange | { gte: Date } | null {
  return month
    ? getManilaMonthRange(month.year, month.month)
    : getRollingRange(range, now);
}

export function getAnalyticsBucketStart(
  value: Date | number,
  bucketMs: number
): number {
  const timestamp = getTimestamp(value);
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    throw new RangeError("Invalid bucket size");
  }

  if (bucketMs === DAY_MS) {
    return getManilaDayRange(timestamp).gte.getTime();
  }

  return Math.floor(timestamp / bucketMs) * bucketMs;
}

export function getAnalyticsBucketRange(
  bucketStart: number,
  bucketMs: number
): ManilaDateRange {
  const start = getTimestamp(bucketStart);
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    throw new RangeError("Invalid bucket size");
  }

  if (bucketMs === DAY_MS) {
    return getManilaDayRange(start);
  }

  return {
    gte: new Date(start),
    lt: new Date(start + bucketMs),
  };
}

export function listAvailableManilaMonths(
  earliest: Date | null,
  now: Date = new Date()
): string[] {
  if (!earliest) return [];

  const start = parseStrictYearMonth(getManilaMonthKey(earliest));
  const end = parseStrictYearMonth(getManilaMonthKey(now));
  if (!start || !end) return [];

  const months: string[] = [];
  let year = end.year;
  let month = end.month;

  while (
    year > start.year ||
    (year === start.year && month >= start.month)
  ) {
    months.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return months;
}
