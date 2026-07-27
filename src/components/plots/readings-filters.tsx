"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, ArrowDownUp } from "lucide-react";

const RANGES: { key: string; label: string }[] = [
  { key: "all", label: "Latest" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ReadingsFilters({
  range,
  month,
  order,
  availableMonths,
}: {
  range: string | null;
  month: string | null;
  order: "asc" | "desc";
  availableMonths: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    p.delete("page"); // reset pagination kapag nagbago ang filter
    const s = p.toString();
    router.push(`${pathname}${s ? `?${s}` : ""}`);
  }

  const activeRange = month ? null : range ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGES.map((r) => {
        const isActive = activeRange === r.key;
        return (
          <button
            key={r.key}
            onClick={() =>
              update({ range: r.key === "all" ? null : r.key, month: null })
            }
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              isActive
                ? "bg-green-600 text-white border-green-600"
                : "bg-card text-gray-700 border-border hover:bg-muted"
            }`}
          >
            {r.label}
          </button>
        );
      })}

      <div className="relative">
        <select
          value={month ?? ""}
          onChange={(e) => update({ month: e.target.value || null, range: null })}
          className={`appearance-none pl-8 pr-7 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
            month
              ? "bg-green-600 text-white border-green-600"
              : "bg-card text-gray-700 border-border hover:bg-muted"
          }`}
        >
          <option value="" className="text-foreground">
            By month
          </option>
          {availableMonths.map((m) => (
            <option key={m} value={m} className="text-foreground">
              {formatMonth(m)}
            </option>
          ))}
        </select>
        <Calendar
          className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
            month ? "text-white" : "text-gray-400"
          }`}
        />
      </div>

      <button
        onClick={() => update({ order: order === "desc" ? "asc" : null })}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border bg-card text-gray-700 border-border hover:bg-muted"
      >
        <ArrowDownUp className="w-3.5 h-3.5 text-gray-400" />
        {order === "desc" ? "Newest" : "Oldest"}
      </button>
    </div>
  );
}