"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";

export function AuthorFilter({
  authors,
  current,
}: {
  authors: { id: string; name: string }[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("authorId");
    } else {
      params.set("authorId", value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? "?" + qs : ""}`);
  }

  return (
    <SearchableSelect
      options={authors.map((a) => ({ value: a.id, label: a.name }))}
      value={current}
      onChange={handleChange}
      allLabel="All authors"
      searchPlaceholder="Search author..."
      emptyText="No authors found"
      width="w-48"
    />
  );
}