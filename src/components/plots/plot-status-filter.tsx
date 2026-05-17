"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PlotStatusFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <Select value={current ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="All status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All status</SelectItem>
        <SelectItem value="PREPARING">Preparing</SelectItem>
        <SelectItem value="PLANTED">Planted</SelectItem>
        <SelectItem value="GROWING">Growing</SelectItem>
        <SelectItem value="READY_FOR_HARVEST">Ready for harvest</SelectItem>
        <SelectItem value="HARVESTED">Harvested</SelectItem>
        <SelectItem value="FALLOW">Fallow</SelectItem>
      </SelectContent>
    </Select>
  );
}