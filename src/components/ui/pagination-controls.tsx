"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemLabel = "items",
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
  }

  if (totalPages <= 1) {
    return (
      <p className="text-sm text-muted-foreground mt-4">
        {totalItems} {itemLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-3">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages} ({totalItems} {itemLabel})
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}