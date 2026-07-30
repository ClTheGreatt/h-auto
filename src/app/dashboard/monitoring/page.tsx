import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PlotFilter } from "@/components/analytics/plot-filter";
import { AuthorFilter } from "@/components/monitoring/author-filter";
import { DateFilter } from "@/components/monitoring/date-filter";
import { LogFeedItem } from "@/components/monitoring/log-feed-item";
import { EmptyState } from "@/components/ui/empty-state";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";
import { parseOptionalPlotIdPageValue } from "@/lib/auth/plot-id";
import {
  MANILA_TIME_ZONE,
  getManilaDayRange,
  parseStrictManilaDateKey,
} from "@/lib/analytics/manila-dates";

const PAGE_SIZE = 10;

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{
    plotId?: string | string[];
    authorId?: string;
    page?: string;
    date?: string | string[];
  }>;
}) {
  const session = await requireAuth();
  const sp = await searchParams;
  const role = session.user.role;
  const parsedPlotId = parseOptionalPlotIdPageValue(sp.plotId);
  if (parsedPlotId.kind === "invalid") notFound();
  const selectedPlotId =
    parsedPlotId.kind === "valid" ? parsedPlotId.plotId : undefined;
  const selectedAuthorId = sp.authorId;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const selectedDate =
    typeof sp.date === "string"
      ? parseStrictManilaDateKey(sp.date) ?? undefined
      : undefined;
  if (sp.date !== undefined && selectedDate === undefined) notFound();

  const dateWindow = selectedDate
    ? getManilaDayRange(selectedDate) ?? undefined
    : undefined;

  // Role-aware base filter. Archived plots (and their logs) are excluded
  // from this active-activity view.
  const plotFilter = buildAccessiblePlotWhere(
    { role, userId: session.user.id },
    { status: { not: "ARCHIVED" } }
  );

  // Build log filter
  const logFilter = {
    plot: plotFilter,
    ...(selectedPlotId !== undefined ? { plotId: selectedPlotId } : {}),
    ...(selectedAuthorId && { userId: selectedAuthorId }),
    ...(dateWindow && { createdAt: dateWindow }),
  };

  // Fetch plots for filter dropdown
  const plots = await prisma.plot.findMany({
    where: plotFilter,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (
    selectedPlotId !== undefined &&
    !plots.some((plot) => plot.id === selectedPlotId)
  ) {
    notFound();
  }

  // Fetch authors for filter dropdown (users who have logged in role-visible plots)
  const authorIds = await prisma.growthLog.findMany({
    where: { plot: plotFilter },
    distinct: ["userId"],
    select: { userId: true },
  });
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds.map((a) => a.userId) } },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });

  // Count for pagination
  const totalLogs = await prisma.growthLog.count({ where: logFilter });
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // Fetch the feed
  const logs = await prisma.growthLog.findMany({
    where: logFilter,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      plot: {
        select: {
          id: true,
          name: true,
          crop: { select: { name: true } },
        },
      },
      stage: { select: { name: true } },
      user: { select: { firstName: true, lastName: true, profileImage: true } },
      images: { select: { id: true, imageUrl: true } },
    },
  });

  const feedItems = logs.map((log) => ({
    id: log.id,
    plotId: log.plot.id,
    plotName: log.plot.name,
    cropName: log.plot.crop?.name ?? null,
    stageName: log.stage?.name ?? null,
    authorName: `${log.user.firstName} ${log.user.lastName}`,
    authorInitials: `${log.user.firstName[0]}${log.user.lastName[0]}`.toUpperCase(),
    authorImage: log.user.profileImage,
    createdAt: log.createdAt,
    observations: log.observations,
    notes: log.notes,
    plantHeightCm: log.plantHeightCm,
    leafCount: log.leafCount,
    soilMoisture: log.soilMoisture,
    temperature: log.temperature,
    humidity: log.humidity,
    lightIntensity: log.lightIntensity,
    nitrogen: log.nitrogen,
    phosphorus: log.phosphorus,
    potassium: log.potassium,
    images: log.images,
  }));

  const hasFilters = selectedPlotId || selectedAuthorId || selectedDate;
  const filteredEmpty = totalLogs === 0 && hasFilters;
  const completelyEmpty = totalLogs === 0 && !hasFilters;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === "STUDENT_FARMER"
              ? "Recent growth observations from your assigned plots."
              : "Recent growth observations from all monitored plots."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateFilter current={selectedDate} />
          <PlotFilter plots={plots} current={selectedPlotId} />
          <AuthorFilter
            authors={authors.map((a) => ({
              id: a.id,
              name: `${a.firstName} ${a.lastName}`,
            }))}
            current={selectedAuthorId}
          />
        </div>
      </div>

      {/* Active filters indicator */}
      {hasFilters && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtered:</span>
          {selectedPlotId && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
              {plots.find((p) => p.id === selectedPlotId)?.name}
            </span>
          )}
          {selectedAuthorId && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              by{" "}
              {authors.find((a) => a.id === selectedAuthorId)?.firstName}{" "}
              {authors.find((a) => a.id === selectedAuthorId)?.lastName}
            </span>
          )}
          {selectedDate && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
              {dateWindow?.gte.toLocaleDateString("en-PH", {
                timeZone: MANILA_TIME_ZONE,
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          <Link
            href="/dashboard/monitoring"
            className="text-green-600 hover:underline text-xs"
          >
            Clear all
          </Link>
        </div>
      )}

      {/* Feed */}
      {completelyEmpty ? (
        <div data-tour="monitoring.feed">
          <EmptyState
            icon={Camera}
            title="No observations yet"
            description={
              role === "STUDENT_FARMER"
                ? "Start logging your plant growth with photos from your plot page."
                : "Growth observations will appear here as student farmers log their plots."
            }
          />
        </div>
      ) : filteredEmpty ? (
        <div data-tour="monitoring.feed">
          <EmptyState
            icon={Camera}
            title="No matches"
            description="No observations match your current filters. Try clearing them."
          />
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {totalLogs} observation{totalLogs === 1 ? "" : "s"}
            {totalPages > 1 && ` • Page ${safePage} of ${totalPages}`}
          </div>

          <div data-tour="monitoring.feed" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {feedItems.map((log) => (
              <LogFeedItem key={log.id} log={log} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-xs text-muted-foreground">
                Page {safePage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                {safePage > 1 && (
                  <Link
                    href={{
                      pathname: "/dashboard/monitoring",
                      query: {
                        ...(selectedPlotId && { plotId: selectedPlotId }),
                        ...(selectedAuthorId && { authorId: selectedAuthorId }),
                        ...(safePage - 1 > 1 && { page: safePage - 1 }),
                      },
                    }}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                  >
                    Previous
                  </Link>
                )}
                {safePage < totalPages && (
                  <Link
                    href={{
                      pathname: "/dashboard/monitoring",
                      query: {
                        ...(selectedPlotId && { plotId: selectedPlotId }),
                        ...(selectedAuthorId && { authorId: selectedAuthorId }),
                        page: safePage + 1,
                      },
                    }}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
