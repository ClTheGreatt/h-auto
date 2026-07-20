import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma, PlotStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PlotsTable } from "@/components/plots/plots-table";
import { SearchBar } from "@/components/ui/search-bar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { CropFilter } from "@/components/plots/crop-filter";
import { PlotStatusFilter } from "@/components/plots/plot-status-filter";

const PAGE_SIZE = 20;

const VALID_STATUSES: PlotStatus[] = [
  "PREPARING",
  "PLANTED",
  "GROWING",
  "READY_FOR_HARVEST",
  "HARVESTED",
  "FALLOW",
];

export default async function PlotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    cropId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireAuth();
  const role = session.user.role;
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const cropId = sp.cropId;
  const status =
    sp.status && VALID_STATUSES.includes(sp.status as PlotStatus)
      ? (sp.status as PlotStatus)
      : undefined;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Role-based base filter
  const roleFilter: Prisma.PlotWhereInput =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : {};

  // Combined where clause. Archived plots are hidden unless a specific
  // status filter is explicitly requested (VALID_STATUSES doesn't include
  // ARCHIVED, so `status` here is never that value).
  const where: Prisma.PlotWhereInput = {
    ...roleFilter,
    status: status ?? { not: "ARCHIVED" },
    ...(cropId && { cropId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        {
          crop: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ],
    }),
  };

  // Fetch in parallel: crops (for filter), count, and page data
  const [crops, totalPlots, plots] = await Promise.all([
    prisma.crop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.plot.count({ where }),
    prisma.plot.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        crop: { select: { name: true } },
        currentStage: { select: { name: true } },
        _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalPlots / PAGE_SIZE));
  const hasFilters = Boolean(search || cropId || status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Plots</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === "STUDENT_FARMER"
              ? "Plots assigned to you for monitoring."
              : "Manage vegetable plots and assigned students."}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/plots/archived"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View archived plots
            </Link>
            <Button data-tour="plots.add-button" asChild>
              <Link href="/dashboard/plots/new">
                <Plus className="w-4 h-4 mr-2" />
                Add plot
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div
        data-tour="plots.filter-bar"
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <div className="flex-1 max-w-sm">
          <SearchBar placeholder="Search name, location, crop..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          <CropFilter crops={crops} current={cropId} />
          <PlotStatusFilter current={status} />
          {hasFilters && (
            <Link
              href="/dashboard/plots"
              className="text-sm text-green-600 hover:underline self-center"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500">
        {totalPlots === 0
          ? "No plots match your filters"
          : `${totalPlots} plot${totalPlots === 1 ? "" : "s"}${hasFilters ? " (filtered)" : ""}`}
      </div>

      {/* Table */}
      <PlotsTable plots={plots} canManage={canManage} />

      {/* Pagination */}
      {totalPlots > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalPlots}
          itemLabel="plots"
        />
      )}
    </div>
  );
}