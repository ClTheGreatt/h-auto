"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALERT_TYPES = [
  { value: "LOW_SOIL_MOISTURE", label: "Low Soil Moisture" },
  { value: "HIGH_SOIL_MOISTURE", label: "High Soil Moisture" },
  { value: "LOW_TEMPERATURE", label: "Low Temperature" },
  { value: "HIGH_TEMPERATURE", label: "High Temperature" },
  { value: "LOW_HUMIDITY", label: "Low Humidity" },
  { value: "HIGH_HUMIDITY", label: "High Humidity" },
  { value: "LOW_LIGHT", label: "Low Light" },
  { value: "HIGH_LIGHT", label: "High Light" },
  { value: "LOW_NITROGEN", label: "Low Nitrogen" },
  { value: "HIGH_NITROGEN", label: "High Nitrogen" },
  { value: "LOW_PHOSPHORUS", label: "Low Phosphorus" },
  { value: "HIGH_PHOSPHORUS", label: "High Phosphorus" },
  { value: "LOW_POTASSIUM", label: "Low Potassium" },
  { value: "HIGH_POTASSIUM", label: "High Potassium" },
  { value: "DEVICE_OFFLINE", label: "Device Offline" },
];

export function AlertTypeFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <Select value={current ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="All types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All types</SelectItem>
        {ALERT_TYPES.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}