import Link from "next/link";
import { Filter } from "lucide-react";
import type { Prisma, AlertSeverity, AlertType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/ui/search-bar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SeverityFilter } from "@/components/alerts/severity-filter";
import { AlertTypeFilter } from "@/components/alerts/alert-type-filter";
import { AlertPlotFilter } from "@/components/alerts/alert-plot-filter";

// Raised from 25: the alerts list is now grouped into plot cards (UI-4), and
// a plot's alerts must never split across a page boundary. Combined with the
// orderBy below (plot name is now the PRIMARY sort key, not just severity),
// a page boundary can only ever fall between two different plots' alerts —
// never through the middle of one plot's own alerts — as long as no single
// plot has more open alerts than this page size (in practice capped at the
// 7 sensor-threshold types + DEVICE_OFFLINE = 8, far below 100).
const PAGE_SIZE = 100;

const VALID_SEVERITIES: AlertSeverity[] = ["INFO", "WARNING", "CRITICAL"];

const VALID_TYPES: AlertType[] = [
  "LOW_SOIL_MOISTURE",
  "HIGH_SOIL_MOISTURE",
  "LOW_TEMPERATURE",
  "HIGH_TEMPERATURE",
  "LOW_HUMIDITY",
  "HIGH_HUMIDITY",
  "LOW_LIGHT",
  "HIGH_LIGHT",
  "LOW_NITROGEN",
  "HIGH_NITROGEN",
  "LOW_PHOSPHORUS",
  "HIGH_PHOSPHORUS",
  "LOW_POTASSIUM",
  "HIGH_POTASSIUM",
  "DEVICE_OFFLINE",
];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    severity?: string;
    type?: string;
    plotId?: string;
    page?: string;
  }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const role = session.user.role;
  const canResolve =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "FACULTY";

  const showResolved = params.status === "resolved";
  const search = params.search?.trim() ?? "";
  const severity =
    params.severity && VALID_SEVERITIES.includes(params.severity as AlertSeverity)
      ? (params.severity as AlertSeverity)
      : undefined;
  const type =
    params.type && VALID_TYPES.includes(params.type as AlertType)
      ? (params.type as AlertType)
      : undefined;
  const plotId = params.plotId;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Role-based plot visibility
  const roleFilter: Prisma.AlertWhereInput =
    role === "STUDENT_FARMER"
      ? {
          plot: {
            assignments: {
              some: { studentId: session.user.id, status: "ACTIVE" as const },
            },
          },
        }
      : role === "FACULTY"
      ? { plot: { facultyId: session.user.id } }
      : {};

  // Build filter
  const where: Prisma.AlertWhereInput = {
    ...roleFilter,
    resolved: showResolved,
    ...(severity && { severity }),
    ...(type && { type }),
    ...(plotId && { plotId }),
    ...(search && {
      OR: [
        { message: { contains: search, mode: "insensitive" } },
        { plot: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  // Get plot list for filter dropdown (role-aware)
  const plotWhere =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : role === "FACULTY"
      ? { facultyId: session.user.id }
      : {};

  // Counts for tabs (Open/Resolved) — use role filter only, not other filters
  const [openCount, resolvedCount, plotsForFilter] = await Promise.all([
    prisma.alert.count({
      where: { resolved: false, ...roleFilter },
    }),
    prisma.alert.count({
      where: { resolved: true, ...roleFilter },
    }),
    prisma.plot.findMany({
      where: plotWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Fetch filtered alerts with count
  const [totalAlerts, alerts] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({
      where,
      // Plot name first so every one of a plot's alerts is contiguous in the
      // full ordered result — required for grouped-by-plot pagination safety
      // (see PAGE_SIZE comment above). Severity/createdAt remain as the
      // within-plot tie-breakers; the UI re-sorts groups by worst severity
      // for display priority independently of this fetch order.
      orderBy: [{ plot: { name: "asc" } }, { severity: "desc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        plot: { select: { id: true, name: true } },
        notifications: {
          select: {
            id: true,
            userId: true,
            channel: true,
            status: true,
            errorMessage: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalAlerts / PAGE_SIZE));
  const hasFilters = Boolean(search || severity || type || plotId);

  // Build URL preserving filters when switching tabs
  function tabUrl(showResolvedTab: boolean): string {
    const p = new URLSearchParams();
    if (showResolvedTab) p.set("status", "resolved");
    if (search) p.set("search", search);
    if (severity) p.set("severity", severity);
    if (type) p.set("type", type);
    if (plotId) p.set("plotId", plotId);
    const qs = p.toString();
    return `/dashboard/alerts${qs ? "?" + qs : ""}`;
  }

  return (
    <div className="space-y-6 max-w-350">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Environmental conditions outside the ideal thresholds for each plot&apos;s
          current growth stage.
        </p>
      </div>

      {/* Open/Resolved tabs */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <Link
          href={tabUrl(false)}
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (!showResolved
              ? "bg-green-100 text-green-700 font-medium"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          Open
          <Badge variant="secondary" className="ml-2 text-xs">
            {openCount}
          </Badge>
        </Link>
        <Link
          href={tabUrl(true)}
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (showResolved
              ? "bg-green-100 text-green-700 font-medium"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          Resolved
          <Badge variant="secondary" className="ml-2 text-xs">
            {resolvedCount}
          </Badge>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar placeholder="Search message or plot..." />
        </div>
        <div data-tour="alerts.filters" className="flex gap-2 flex-wrap">
          <SeverityFilter current={severity} />
          <AlertTypeFilter current={type} />
          <AlertPlotFilter plots={plotsForFilter} current={plotId} />
          {hasFilters && (
            <Link
              href={
                showResolved ? "/dashboard/alerts?status=resolved" : "/dashboard/alerts"
              }
              className="text-sm text-green-600 hover:underline self-center"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {totalAlerts === 0
          ? `No ${showResolved ? "resolved" : "open"} alerts match your filters`
          : `${totalAlerts} ${showResolved ? "resolved" : "open"} alert${totalAlerts === 1 ? "" : "s"}${hasFilters ? " (filtered)" : ""}`}
      </div>

      {/* Table */}
      <AlertsTable
        alerts={alerts}
        canResolve={canResolve}
        emptyMessage={
          hasFilters
            ? "No alerts match your filters"
            : showResolved
            ? "No resolved alerts yet"
            : "No open alerts"
        }
      />

      {/* Pagination */}
      {totalAlerts > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalAlerts}
          itemLabel="alerts"
        />
      )}
    </div>
  );
}
