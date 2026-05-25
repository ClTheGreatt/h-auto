"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar } from "lucide-react";

function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
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

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("month");
    } else {
      params.set("month", value);
      params.delete("range");
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <div className="relative">
      <select
        value={current ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className={
          "appearance-none pl-8 pr-7 py-1.5 rounded-md text-xs border cursor-pointer transition " +
          (current
            ? "bg-green-600 text-white border-green-600"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
        }
      >
        <option value="" className="text-gray-900">
          By month
        </option>
        {availableMonths.map((m) => (
          <option key={m} value={m} className="text-gray-900">
            {formatMonth(m)}
          </option>
        ))}
      </select>
      <Calendar
        className={
          "w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none " +
          (current ? "text-white" : "text-gray-400")
        }
      />
    </div>
  );
}