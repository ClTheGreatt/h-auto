"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SeverityFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("severity");
    } else {
      params.set("severity", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <Select value={current ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="All severity" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All severity</SelectItem>
        <SelectItem value="CRITICAL">Critical</SelectItem>
        <SelectItem value="WARNING">Warning</SelectItem>
        <SelectItem value="INFO">Info</SelectItem>
      </SelectContent>
    </Select>
  );
}