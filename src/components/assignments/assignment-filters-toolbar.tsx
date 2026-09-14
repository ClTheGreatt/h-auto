"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssignmentPlotFilter } from "@/components/assignments/assignment-plot-filter";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { SectionFilter } from "@/components/users/section-filter";
import { clearAssignmentFilterParams } from "@/lib/assignments/assignment-filters";

export function AssignmentFiltersToolbar({
  plots,
  currentPlotId,
  sections,
  currentSection,
  canManageAssignments,
  showClearFilters,
}: {
  plots: { id: string; name: string }[];
  currentPlotId?: string;
  sections: string[];
  currentSection?: string;
  canManageAssignments: boolean;
  showClearFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchResetKey, setSearchResetKey] = useState(0);

  function handleClearFilters() {
    setSearchResetKey((key) => key + 1);
    const queryString = clearAssignmentFilterParams(searchParams.toString());
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
      {canManageAssignments && (
        <>
          <SearchBar
            placeholder="Search name, email, or student number..."
            ariaLabel="Search assignments by student name, email, or student number"
            className="max-w-none sm:min-w-64 sm:max-w-sm sm:flex-1"
            resetKey={searchResetKey}
          />
          <SectionFilter
            current={currentSection}
            options={sections}
            ariaLabel="Filter assignments by section"
            className="w-full sm:w-40"
          />
        </>
      )}
      <AssignmentPlotFilter plots={plots} current={currentPlotId} />
      {showClearFilters && (
        <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
