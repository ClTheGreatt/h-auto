"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AssignmentPlotFilter({
  plots,
  current,
}: {
  plots: { id: string; name: string }[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("plotId");
    } else {
      params.set("plotId", value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <Select value={current ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="All plots" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All plots</SelectItem>
        {plots.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
