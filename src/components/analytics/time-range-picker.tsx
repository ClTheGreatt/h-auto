"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TIME_RANGES, type TimeRange } from "@/lib/analytics/time-range";

export function TimeRangePicker({ current }: { current: TimeRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleClick(range: TimeRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center bg-gray-100 rounded-md p-1 gap-1">
      {TIME_RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => handleClick(r.value)}
          className={
            "px-3 py-1 text-xs rounded transition " +
            (current === r.value
              ? "bg-white text-green-700 font-medium shadow-sm"
              : "text-gray-600 hover:text-gray-900")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}