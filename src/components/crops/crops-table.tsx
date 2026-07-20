"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Sprout,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteCropDialog } from "./delete-crop-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CropRow = {
  id: string;
  name: string;
  variety: string | null;
  daysToHarvest: number;
  _count: { stages: number; plots: number };
};

type Props = {
  crops: CropRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  query: string;
  sort: string;
};

export function CropsTable({
  crops,
  total,
  page,
  totalPages,
  pageSize,
  query,
  sort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchState, setSearchState] = useState({ query, value: query });
  const searchInput =
    searchState.query === query ? searchState.value : query;

  // Debounce search (300ms)
  useEffect(() => {
    if (searchInput === query) return;
    const t = setTimeout(() => {
      updateParams({ q: searchInput || null, page: null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearAll() {
    setSearchState({ query, value: "" });
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters = query.length > 0 || sort !== "name-asc";
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* 🔍 Search + 🎛️ Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-[360px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search crop or variety..."
            value={searchInput}
            onChange={(e) =>
              setSearchState({ query, value: e.target.value })
            }
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchState({ query, value: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select
          value={sort}
          onValueChange={(value) =>
            updateParams({
              sort: value === "name-asc" ? null : value,
              page: null,
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A–Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z–A)</SelectItem>
            <SelectItem value="days-asc">Days to harvest (low → high)</SelectItem>
            <SelectItem value="days-desc">Days to harvest (high → low)</SelectItem>
            <SelectItem value="recent">Recently added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Result count + clear */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>
          {total === 0 ? (
            <span>No results</span>
          ) : hasFilters ? (
            <span>
              Showing {start}–{end} of {total} crop{total !== 1 ? "s" : ""}
              {query && <> matching &quot;{query}&quot;</>}
            </span>
          ) : (
            <span>
              {total} crop{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table / empty state */}
      {crops.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title={query ? "No crops match your search" : "No crops yet"}
          description={
            query
              ? `No crops match "${query}". Try a different search.`
              : 'Click "Add crop" to create one.'
          }
        />
      ) : (
        <Card
          className={cn(
            "overflow-x-auto p-0 transition-opacity",
            isPending && "opacity-60"
          )}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crop</TableHead>
                <TableHead>Variety</TableHead>
                <TableHead>Days to harvest</TableHead>
                <TableHead>Stages</TableHead>
                <TableHead>In use</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.map((crop) => (
                <TableRow key={crop.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/crops/${crop.id}/edit`}
                      className="hover:underline"
                    >
                      {crop.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {crop.variety ?? "—"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {crop.daysToHarvest} days
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {crop._count.stages} stages
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {crop._count.plots > 0 ? (
                      <Badge variant="outline">
                        {crop._count.plots} plot
                        {crop._count.plots !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">Not planted</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/crops/${crop.id}/edit`}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DeleteCropDialog
                          cropId={crop.id}
                          cropName={crop.name}
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          }
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

{/* Bottom count (consistency w/ Plots) */}
      {crops.length > 0 && (
        <div className="text-sm text-gray-500">
          {total} crop{total !== 1 ? "s" : ""}
          {totalPages > 1 && <> · Page {page} of {totalPages}</>}
        </div>
      )}
      
      {/* 📄 Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() =>
                updateParams({ page: page > 2 ? String(page - 1) : null })
              }
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
