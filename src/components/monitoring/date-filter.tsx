"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, X } from "lucide-react";

export function DateFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setDate(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("date");
    } else {
      params.set("date", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <div className="flex items-center gap-1.5 border rounded-md px-2.5 h-9 bg-card">
      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <input
        type="date"
        value={current ?? ""}
        onChange={(e) => setDate(e.target.value)}
        className="text-sm text-gray-700 outline-none bg-transparent w-[130px]"
        aria-label="Filter by log date"
      />
      {current && (
        <button
          type="button"
          onClick={() => setDate("")}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="Clear date filter"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
