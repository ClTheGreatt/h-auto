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
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";

const PAGE_SIZE = 20;

const VALID_STATUSES: PlotStatus[] = [
  "PREPARING",
  "PLANTED",
  "GROWING",
  "READY_FOR_HARVEST",
  "HARVESTED",
  "FALLOW",
];

const ACTIVE_STATUSES = [
  "PREPARING",
  "PLANTED",
  "GROWING",
  "READY_FOR_HARVEST",
] as const;
const COMPLETED_STATUSES = ["HARVESTED", "FALLOW"] as const;

export default async function PlotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    cropId?: string;
    status?: string;
    view?: string;
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
  const view = sp.view === "completed" ? "completed" : "active";
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Status scope: an explicit ?status= pick wins outright (unchanged
  // dropdown behavior); otherwise fall back to the current tab's status
  // bucket. Both buckets exclude ARCHIVED by construction, so archived
  // plots never leak into either tab.
  const statusWhere: Prisma.PlotWhereInput = status
    ? { status }
    : { status: { in: view === "completed" ? [...COMPLETED_STATUSES] : [...ACTIVE_STATUSES] } };

  // Combined where clause.
  const where = buildAccessiblePlotWhere(
    { role, userId: session.user.id },
    {
      ...statusWhere,
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
    }
  );

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

  // Build URL preserving filters when switching tabs (page resets to 1)
  function tabUrl(targetView: "active" | "completed"): string {
    const p = new URLSearchParams();
    if (targetView === "completed") p.set("view", "completed");
    if (search) p.set("search", search);
    if (cropId) p.set("cropId", cropId);
    if (status) p.set("status", status);
    const qs = p.toString();
    return `/dashboard/plots${qs ? "?" + qs : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Plots</h1>
          <p className="text-sm text-muted-foreground mt-1">
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

      {/* Active/Completed tabs */}
      <div className="flex items-center gap-2">
        <Link
          href={tabUrl("active")}
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (view === "active"
              ? "bg-green-100 text-green-700 font-medium"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          Active
        </Link>
        <Link
          href={tabUrl("completed")}
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (view === "completed"
              ? "bg-green-100 text-green-700 font-medium"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          Completed
        </Link>
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
      <div className="text-xs text-muted-foreground">
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
