"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getManilaMonthKey } from "@/lib/analytics/manila-dates";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Module-level (labas sa render) para iwas React Compiler purity rule.
// Fallback lang ito kapag wala pang anumang datos.
const THIS_YEAR = Number(getManilaMonthKey(new Date()).slice(0, 4));

function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function yearOf(ym: string) {
  return Number(ym.split("-")[0]);
}

export function MonthPicker({
  current,
  availableMonths,
}: {
  current?: string;
  availableMonths: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableSet = new Set(availableMonths);
  const years = Array.from(new Set(availableMonths.map(yearOf))).sort(
    (a, b) => b - a
  );
  const maxYear = years[0] ?? THIS_YEAR;
  const minYear = years[years.length - 1] ?? THIS_YEAR;

  const defaultYear = current ? yearOf(current) : maxYear;
  const [viewYear, setViewYear] = useState(defaultYear);

  // Isara kapag nag-click sa labas
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    if (!open) setViewYear(current ? yearOf(current) : maxYear);
    setOpen((o) => !o);
  }

  function selectMonth(ym: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", ym);
    params.delete("range");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
    setOpen(false);
  }

  function clearMonth() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
    setOpen(false);
  }

  const label = current ? formatMonth(current) : "By month";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className={
          "inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-md text-xs border cursor-pointer transition " +
          (current
            ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
            : "bg-card text-gray-700 border-border hover:bg-muted")
        }
      >
        <Calendar
          className={"w-3.5 h-3.5 " + (current ? "text-white" : "text-gray-400")}
        />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-50 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
          {/* Year stepper */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              disabled={viewYear <= minYear}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous year"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= maxYear}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next year"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* 12-month grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_LABELS.map((m, i) => {
              const ym = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
              const enabled = availableSet.has(ym);
              const isSelected = ym === current;
              return (
                <button
                  key={ym}
                  type="button"
                  disabled={!enabled}
                  onClick={() => selectMonth(ym)}
                  className={
                    "py-1.5 rounded-md text-xs font-medium transition " +
                    (isSelected
                      ? "bg-green-600 text-white"
                      : enabled
                      ? "text-gray-700 hover:bg-green-50 hover:text-green-700"
                      : "text-gray-300 cursor-not-allowed")
                  }
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {current && (
            <button
              type="button"
              onClick={clearMonth}
              className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-gray-700 py-1"
            >
              Clear month filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
