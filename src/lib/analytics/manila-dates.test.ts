import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY_MS,
  getAnalyticsBucketRange,
  getAnalyticsBucketStart,
  getAnalyticsDateFilter,
  getCurrentManilaDayRange,
  getManilaDateKey,
  getManilaDayRange,
  getManilaMonthKey,
  getManilaMonthRange,
  getRollingRange,
  parseApiMonthValues,
  parseStrictYearMonth,
  parseWebMonthParam,
  type ManilaDateRange,
} from "./manila-dates";

function assertMonthRange(
  range: ManilaDateRange,
  expectedStart: string,
  expectedEnd: string,
  expectedLastMonth: string,
  expectedNextMonth: string
) {
  assert.equal(range.gte.toISOString(), expectedStart);
  assert.equal(range.lt.toISOString(), expectedEnd);

  const contains = (timestamp: number) =>
    timestamp >= range.gte.getTime() && timestamp < range.lt.getTime();
  assert.equal(contains(range.lt.getTime() - 1), true);
  assert.equal(contains(range.lt.getTime()), false);
  assert.equal(
    getManilaMonthKey(new Date(range.lt.getTime() - 1)),
    expectedLastMonth
  );
  assert.equal(getManilaMonthKey(range.lt), expectedNextMonth);
}

test("strictly parses valid four-digit year-month values", () => {
  assert.deepEqual(parseStrictYearMonth("2026-07"), {
    value: "2026-07",
    year: 2026,
    month: 7,
  });
  assert.equal(parseStrictYearMonth("2026-01")?.month, 1);
  assert.equal(parseStrictYearMonth("2026-12")?.month, 12);
});

test("rejects invalid, normalized, abbreviated, or padded month input", () => {
  for (const value of [
    "2026-00",
    "2026-13",
    "26-07",
    "2026-7",
    " 2026-07",
    "2026-07 ",
    "2026-07-extra",
    "",
  ]) {
    assert.equal(parseStrictYearMonth(value), null, value);
  }
});

test("January 2026 uses Manila boundaries and excludes February", () => {
  assertMonthRange(
    getManilaMonthRange(2026, 1),
    "2025-12-31T16:00:00.000Z",
    "2026-01-31T16:00:00.000Z",
    "2026-01",
    "2026-02"
  );
});

test("July 2026 uses Manila calendar-month boundaries", () => {
  assertMonthRange(
    getManilaMonthRange(2026, 7),
    "2026-06-30T16:00:00.000Z",
    "2026-07-31T16:00:00.000Z",
    "2026-07",
    "2026-08"
  );
});

test("December 2026 rolls over to January 2027 at Manila midnight", () => {
  assertMonthRange(
    getManilaMonthRange(2026, 12),
    "2026-11-30T16:00:00.000Z",
    "2026-12-31T16:00:00.000Z",
    "2026-12",
    "2027-01"
  );
});

test("leap-year February 2024 includes Manila February 29", () => {
  assertMonthRange(
    getManilaMonthRange(2024, 2),
    "2024-01-31T16:00:00.000Z",
    "2024-02-29T16:00:00.000Z",
    "2024-02",
    "2024-03"
  );
});

test("non-leap February 2026 ends before Manila March 1", () => {
  assertMonthRange(
    getManilaMonthRange(2026, 2),
    "2026-01-31T16:00:00.000Z",
    "2026-02-28T16:00:00.000Z",
    "2026-02",
    "2026-03"
  );
});

test("API month collections distinguish absence from one valid value", () => {
  assert.deepEqual(parseApiMonthValues([]), { kind: "absent" });
  assert.deepEqual(parseApiMonthValues(["2026-07"]), {
    kind: "valid",
    month: { value: "2026-07", year: 2026, month: 7 },
  });
});

test("API month collections reject empty and whitespace values", () => {
  assert.deepEqual(parseApiMonthValues([""]), { kind: "invalid" });
  assert.deepEqual(parseApiMonthValues(["   "]), { kind: "invalid" });
});

test("API month collections reject every duplicate representation", () => {
  for (const values of [
    ["2026-07", "2026-07"],
    ["2026-07", "2026-08"],
    ["", "2026-07"],
    ["2026-07", ""],
  ]) {
    assert.deepEqual(
      parseApiMonthValues(values),
      { kind: "invalid" },
      JSON.stringify(values)
    );
  }
});

test("API month collections reject malformed and numeric-invalid months", () => {
  for (const values of [["2026-7"], ["2026-00"], ["2026-13"]]) {
    assert.deepEqual(
      parseApiMonthValues(values),
      { kind: "invalid" },
      JSON.stringify(values)
    );
  }
});

test("Server Component month values distinguish absence from a valid string", () => {
  assert.deepEqual(parseWebMonthParam(undefined), { kind: "absent" });
  assert.deepEqual(parseWebMonthParam("2026-07"), {
    kind: "valid",
    month: { value: "2026-07", year: 2026, month: 7 },
  });
});

test("Server Component month values reject empty, whitespace, and malformed strings", () => {
  for (const value of ["", "   ", "2026-7"]) {
    assert.deepEqual(
      parseWebMonthParam(value),
      { kind: "invalid" },
      JSON.stringify(value)
    );
  }
});

test("Server Component month values reject all string-array representations", () => {
  for (const value of [
    ["2026-07"],
    ["2026-07", "2026-07"],
    ["", "2026-07"],
    ["2026-07", ""],
  ]) {
    assert.deepEqual(
      parseWebMonthParam(value),
      { kind: "invalid" },
      JSON.stringify(value)
    );
  }
});

test("web and mobile month adapters accept and reject equivalent values", () => {
  for (const value of ["2026-07", "", "   ", "2026-7", "2026-00", "2026-13"]) {
    const api = parseApiMonthValues([value]);
    const web = parseWebMonthParam(value);
    assert.deepEqual(api, web, value);
  }
  assert.equal(parseApiMonthValues(["2026-07", ""]).kind, "invalid");
  assert.equal(parseWebMonthParam(["2026-07", ""]).kind, "invalid");
});

test("web and mobile month filters share identical half-open Manila boundaries", () => {
  const apiMonth = parseApiMonthValues(["2026-07"]);
  const webMonth = parseWebMonthParam("2026-07");
  assert.equal(apiMonth.kind, "valid");
  assert.equal(webMonth.kind, "valid");
  if (apiMonth.kind !== "valid" || webMonth.kind !== "valid") return;

  const apiFilter = getAnalyticsDateFilter(apiMonth.month, "7d");
  const webFilter = getAnalyticsDateFilter(webMonth.month, "7d");
  assert.deepEqual(apiFilter, webFilter);
  assert.ok(apiFilter && "lt" in apiFilter);
  assert.equal(apiFilter.gte.toISOString(), "2026-06-30T16:00:00.000Z");
  assert.equal(apiFilter.lt.toISOString(), "2026-07-31T16:00:00.000Z");
});

test("Manila midnight maps to the correct UTC timestamp", () => {
  const range = getManilaDayRange("2026-07-30");
  assert.ok(range);
  assert.equal(range.gte.toISOString(), "2026-07-29T16:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-07-30T16:00:00.000Z");
});

test("web and mobile daily keys preserve the Manila calendar date", () => {
  const instant = new Date("2026-07-29T16:30:00.000Z");
  const webBucket = getAnalyticsBucketStart(instant, DAY_MS);
  const mobileBucket = getAnalyticsBucketStart(instant, DAY_MS);
  assert.equal(getManilaDateKey(webBucket), "2026-07-30");
  assert.equal(getManilaDateKey(mobileBucket), "2026-07-30");
  assert.equal(getManilaDateKey(new Date("2026-07-29T15:59:59.999Z")), "2026-07-29");
});

test("daily buckets use Manila midnight and a half-open end", () => {
  const bucketStart = getAnalyticsBucketStart(
    new Date("2026-07-30T00:30:00+08:00"),
    DAY_MS
  );
  const range = getAnalyticsBucketRange(bucketStart, DAY_MS);
  assert.equal(new Date(bucketStart).toISOString(), "2026-07-29T16:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-07-30T16:00:00.000Z");
  const isIncluded = (timestamp: number) =>
    timestamp >= range.gte.getTime() && timestamp < range.lt.getTime();
  assert.equal(isIncluded(range.lt.getTime() - 1), true);
  assert.equal(isIncluded(range.lt.getTime()), false);
});

test("web and mobile rolling filters are identical for a supplied instant", () => {
  const now = new Date("2026-07-30T12:34:56.789Z");
  const expected: Record<"24h" | "7d" | "30d", string> = {
    "24h": "2026-07-29T12:34:56.789Z",
    "7d": "2026-07-23T12:34:56.789Z",
    "30d": "2026-06-30T12:34:56.789Z",
  };

  for (const range of ["24h", "7d", "30d"] as const) {
    const webFilter = getAnalyticsDateFilter(null, range, now);
    const mobileFilter = getAnalyticsDateFilter(null, range, now);
    assert.deepEqual(webFilter, mobileFilter);
    assert.equal(webFilter?.gte.toISOString(), expected[range]);
  }
  assert.equal(getAnalyticsDateFilter(null, "all", now), null);
  assert.equal(getRollingRange("all", now), null);
});

test("mobile today builds one deterministic gte/lt Manila range", () => {
  const suppliedNow = new Date("2026-07-30T10:15:30.000Z");
  const range = getCurrentManilaDayRange(suppliedNow);
  assert.deepEqual(Object.keys(range).sort(), ["gte", "lt"]);
  assert.equal(range.gte.toISOString(), "2026-07-29T16:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-07-30T16:00:00.000Z");
  assert.equal(suppliedNow.toISOString(), "2026-07-30T10:15:30.000Z");

  const contains = (timestamp: number) =>
    timestamp >= range.gte.getTime() && timestamp < range.lt.getTime();
  assert.equal(contains(range.lt.getTime() - 1), true);
  assert.equal(contains(range.lt.getTime()), false);
});
