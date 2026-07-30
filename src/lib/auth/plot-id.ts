const CUID_PATTERN = /^c[a-z0-9]{24}$/;

export type ParsedOptionalPlotId =
  | { kind: "absent" }
  | { kind: "valid"; plotId: string }
  | {
      kind: "invalid";
      reason: "empty" | "whitespace" | "duplicate" | "malformed";
    };

export function isValidPlotId(value: string): boolean {
  return CUID_PATTERN.test(value);
}

export function parseOptionalPlotIdValues(
  values: readonly string[]
): ParsedOptionalPlotId {
  if (values.length === 0) return { kind: "absent" };
  if (values.length > 1) return { kind: "invalid", reason: "duplicate" };

  const [value] = values;
  if (value.length === 0) return { kind: "invalid", reason: "empty" };
  if (value.trim().length === 0) {
    return { kind: "invalid", reason: "whitespace" };
  }
  if (!isValidPlotId(value)) {
    return { kind: "invalid", reason: "malformed" };
  }

  return { kind: "valid", plotId: value };
}

export function parseOptionalPlotIdSearchParams(
  searchParams: Pick<URLSearchParams, "getAll">
): ParsedOptionalPlotId {
  return parseOptionalPlotIdValues(searchParams.getAll("plotId"));
}

export function parseOptionalPlotIdPageValue(
  value: string | string[] | undefined
): ParsedOptionalPlotId {
  if (value === undefined) return { kind: "absent" };
  return parseOptionalPlotIdValues(
    typeof value === "string" ? [value] : value
  );
}
