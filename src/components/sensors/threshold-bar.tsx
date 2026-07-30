"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatSensorRange,
  formatSensorValue,
  getThresholdStatus,
  getBarPosition,
  type SensorType,
  type ThresholdStatus,
} from "@/lib/sensors/threshold-status";

export type ThresholdBarProps = {
  label: string;
  value: number | null;
  sensorType: SensorType;
  min: number;
  max: number;
  isHistorical?: boolean;
};

const MARKER_DOT_CLASS: Record<ThresholdStatus, string> = {
  optimal: "bg-success-text",
  low: "bg-danger-text",
  high: "bg-danger-text",
};

const STATUS_TEXT_CLASS: Record<ThresholdStatus, string> = {
  optimal: "text-success-text",
  low: "text-danger-text",
  high: "text-danger-text",
};

// Status word shown next to the value — position on the bar and this label
// both carry the low/optimal/high signal, so color is never the only cue.
const STATUS_LABEL: Record<ThresholdStatus, string> = {
  optimal: "Optimal",
  low: "Low",
  high: "High",
};

export function ThresholdBar({
  label,
  value,
  sensorType,
  min,
  max,
  isHistorical = false,
}: ThresholdBarProps) {
  if (value == null) {
    return (
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm text-muted-foreground mt-1">No reading</div>
      </div>
    );
  }

  const formattedValue = formatSensorValue(value, sensorType);
  const status = getThresholdStatus(value, min, max);
  const position = getBarPosition(value, min, max, sensorType);

  if (
    status === "invalid-range" ||
    status === "invalid-reading" ||
    position == null
  ) {
    return (
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold text-muted-foreground mt-0.5">
          {formattedValue}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {status === "invalid-reading"
            ? `ideal ${formatSensorRange(min, max, sensorType)}`
            : "Invalid ideal range"}
        </div>
      </div>
    );
  }

  const { percent, clamped, bandStartPercent, bandEndPercent } = position;

  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-sm font-semibold mt-0.5 flex items-center gap-1.5 ${
          isHistorical ? "text-muted-foreground" : STATUS_TEXT_CLASS[status]
        }`}
      >
        <span>{formattedValue}</span>
        {status !== "optimal" && (
          <span className="text-[10px] font-bold uppercase tracking-wide">
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div
        className="relative h-2 rounded-full bg-background border border-border mt-2 overflow-visible"
        aria-hidden="true"
      >
        {/* Ideal band — position comes from getBarPosition's
            bandStartPercent/bandEndPercent, NOT a fixed middle third, since
            the domain is floored at 0 and can be asymmetric (see
            threshold-status.ts). */}
        <div
          className="absolute inset-y-0 bg-success-bg rounded-full"
          style={{
            left: `${bandStartPercent}%`,
            width: `${bandEndPercent - bandStartPercent}%`,
          }}
        />

        {clamped === "low" ? (
          <ChevronLeft
            className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
              isHistorical ? "text-muted-foreground" : "text-danger-text"
            }`}
          />
        ) : clamped === "high" ? (
          <ChevronRight
            className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
              isHistorical ? "text-muted-foreground" : "text-danger-text"
            }`}
          />
        ) : (
          <div
            className={`absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-card -translate-y-1/2 -translate-x-1/2 transition-[left] duration-300 ease-out ${
              isHistorical ? "bg-muted-foreground" : MARKER_DOT_CLASS[status]
            }`}
            style={{ left: `${percent}%` }}
          />
        )}
      </div>

      <div className="text-[11px] text-muted-foreground mt-1">
        ideal {formatSensorRange(min, max, sensorType)}
      </div>
    </div>
  );
}
