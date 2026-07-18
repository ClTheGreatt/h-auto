"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SectionFilter({
  current,
  options,
  disabled,
}: {
  current?: string;
  options: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("section");
    } else {
      params.set("section", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <Select value={current ?? "all"} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="All sections" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All sections</SelectItem>
        {options.map((section) => (
          <SelectItem key={section} value={section}>
            {section}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
