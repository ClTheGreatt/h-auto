"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getThresholdStatus,
  getBarPosition,
  type ThresholdStatus,
} from "@/lib/sensors/threshold-status";

export type ThresholdBarProps = {
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
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

export function ThresholdBar({ label, value, unit, min, max }: ThresholdBarProps) {
  if (value == null) {
    return (
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm text-muted-foreground mt-1">No reading</div>
      </div>
    );
  }

  const status = getThresholdStatus(value, min, max);
  const { percent, clamped } = getBarPosition(value, min, max);

  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-sm font-semibold mt-0.5 flex items-center gap-1.5 ${STATUS_TEXT_CLASS[status]}`}
      >
        <span>
          {value}
          {unit}
        </span>
        {status !== "optimal" && (
          <span className="text-[10px] font-bold uppercase tracking-wide">
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div
        className="relative h-2 rounded-full bg-muted mt-2 overflow-visible"
        aria-hidden="true"
      >
        {/* Ideal band — always the middle third, matching getBarPosition's
            domain (domainMin..min..max..domainMax = 3 equal segments). */}
        <div className="absolute inset-y-0 left-[33.3333%] right-[33.3333%] bg-success-bg rounded-full" />

        {clamped === "low" ? (
          <ChevronLeft
            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-danger-text"
          />
        ) : clamped === "high" ? (
          <ChevronRight
            className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-danger-text"
          />
        ) : (
          <div
            className={`absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-card -translate-y-1/2 -translate-x-1/2 transition-[left] duration-300 ease-out ${MARKER_DOT_CLASS[status]}`}
            style={{ left: `${percent}%` }}
          />
        )}
      </div>

      <div className="text-[11px] text-muted-foreground mt-1">
        ideal {min}–{max}
        {unit}
      </div>
    </div>
  );
}
