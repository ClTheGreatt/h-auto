"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchBar({
  placeholder = "Search...",
  paramName = "search",
  ariaLabel = placeholder,
  className,
  resetKey = 0,
}: {
  placeholder?: string;
  paramName?: string;
  ariaLabel?: string;
  className?: string;
  resetKey?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const paramValue = searchParams.get(paramName) ?? "";
  const [previousParamValue, setPreviousParamValue] = useState(paramValue);
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  const [value, setValue] = useState(paramValue);

  if (previousResetKey !== resetKey) {
    setPreviousResetKey(resetKey);
    setPreviousParamValue(paramValue);
    setValue("");
  } else if (previousParamValue !== paramValue) {
    setPreviousParamValue(paramValue);
    setValue(paramValue);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      const queryString = params.toString();
      if (queryString !== searchParamsString) {
        router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [paramName, pathname, resetKey, router, searchParamsString, value]);

  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <Input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
