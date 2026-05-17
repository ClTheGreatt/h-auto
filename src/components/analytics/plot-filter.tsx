"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";

export function PlotFilter({
  plots,
  current,
}: {
  plots: { id: string; name: string }[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("plotId");
    } else {
      params.set("plotId", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <SearchableSelect
      options={plots.map((p) => ({ value: p.id, label: p.name }))}
      value={current}
      onChange={handleChange}
      allLabel="All plots"
      searchPlaceholder="Search plot..."
      emptyText="No plots found"
      width="w-48"
    />
  );
}