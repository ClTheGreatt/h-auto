import { parseOptionalPlotIdValues } from "@/lib/auth/plot-id";

export type MobilePlotSelection<T> =
  | { kind: "ok"; plots: T[] }
  | { kind: "error"; status: 400 | 404 };

export async function resolveMobilePlotSelection<T>(
  plotIdValues: readonly string[],
  findAccessiblePlots: (plotId?: string) => Promise<T[]>
): Promise<MobilePlotSelection<T>> {
  const parsed = parseOptionalPlotIdValues(plotIdValues);
  if (parsed.kind === "invalid") {
    return { kind: "error", status: 400 };
  }

  const plotId = parsed.kind === "valid" ? parsed.plotId : undefined;
  const plots = await findAccessiblePlots(plotId);
  if (plotId !== undefined && plots.length === 0) {
    return { kind: "error", status: 404 };
  }

  return { kind: "ok", plots };
}
