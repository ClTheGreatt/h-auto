import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format-date";
import { getDeviceFreshness } from "@/lib/utils/device-status";
import { ReadingsFilters } from "@/components/plots/readings-filters";
import { LiveRefresh } from "@/components/plots/live-refresh";
import { findReadingHistoryPlot } from "@/lib/auth/plot-access";
import {
  MANILA_TIME_ZONE,
  getAnalyticsDateFilter,
  getManilaDateKey,
  listAvailableManilaMonths,
  parseWebMonthParam,
  type ParsedYearMonth,
} from "@/lib/analytics/manila-dates";

const PAGE_SIZE = 50;

type SP = {
  range?: string;
  month?: string | string[];
  order?: string;
  page?: string;
};

function fmt(v: number | null, suffix: string, digits = 0) {
  return v === null || v === undefined ? "—" : `${v.toFixed(digits)}${suffix}`;
}

export default async function PlotReadingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const role = session.user.role;
  const order: "asc" | "desc" = sp.order === "asc" ? "asc" : "desc";
  const monthResult = parseWebMonthParam(sp.month);
  if (monthResult.kind === "invalid") notFound();
  const parsedMonth =
    monthResult.kind === "valid" ? monthResult.month : null;
  const month = parsedMonth?.value ?? null;
  const range = sp.range === "7d" || sp.range === "30d" ? sp.range : null;
  const page = Math.max(1, Number(sp.page) || 1);

  const plot = await findReadingHistoryPlot(
    role,
    session.user.id,
    id,
    (where) =>
      prisma.plot.findFirst({
        where,
        select: {
          id: true,
          name: true,
          device: { select: { id: true, lastSeenAt: true } },
        },
      })
  );
  if (!plot) notFound();

  const now = new Date();
  const deviceFreshness = getDeviceFreshness(plot.device?.lastSeenAt, now);

  // date window
  const recordedAt = resolveWindow(parsedMonth, range);

  const rows = await prisma.sensorReading.findMany({
    where: { plotId: id, ...(recordedAt && { recordedAt }) },
    orderBy: { recordedAt: order },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      recordedAt: true,
      soilMoisture: true,
      temperature: true,
      humidity: true,
      lightIntensity: true,
      nitrogen: true,
      phosphorus: true,
      potassium: true,
    },
  });
  const hasNext = rows.length > PAGE_SIZE;
  const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows;

  // available months (earliest reading -> now)
  const earliest = await prisma.sensorReading.findFirst({
    where: { plotId: id },
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true },
  });
  const availableMonths = listAvailableManilaMonths(
    earliest?.recordedAt ?? null
  );

  // group by day (Asia/Manila para tugma sa mobile)
  type Item = (typeof items)[number];
  const groups: { key: string; title: string; items: Item[] }[] = [];
  const byKey = new Map<string, { key: string; title: string; items: Item[] }>();
  for (const r of items) {
    const key = getManilaDateKey(r.recordedAt);
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        title: r.recordedAt.toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: MANILA_TIME_ZONE,
        }),
        items: [],
      };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(r);
  }

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (range) p.set("range", range);
    if (month) p.set("month", month);
    if (order === "asc") p.set("order", "asc");
    if (nextPage !== 1) p.set("page", String(nextPage));
    const s = p.toString();
    return `/dashboard/plots/${id}/readings${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href={`/dashboard/plots/${id}`}
          className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plot
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          Readings history
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{plot.name}</p>
        {plot.device && (
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge
              variant={
                deviceFreshness.state === "FRESH"
                  ? "success"
                  : deviceFreshness.state === "STALE"
                  ? "warning"
                  : deviceFreshness.state === "OFFLINE"
                  ? "danger"
                  : "neutral"
              }
            >
              {deviceFreshness.state === "FRESH"
                ? "Fresh"
                : deviceFreshness.state === "STALE"
                ? "Delayed"
                : deviceFreshness.state === "OFFLINE"
                ? "Offline"
                : "Never reported"}
            </StatusBadge>
            {plot.device.lastSeenAt && (
              <span className="text-xs text-muted-foreground">
                Last seen {formatDateTime(plot.device.lastSeenAt)}
              </span>
            )}
            <LiveRefresh />
          </div>
        )}
      </div>

      <ReadingsFilters
        range={range}
        month={month}
        order={order}
        availableMonths={availableMonths}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            {earliest ? (
              // Readings exist somewhere for this plot — just not within
              // the current filter — regardless of whether a device is
              // still attached today.
              <EmptyState
                compact
                icon={Activity}
                title="No readings in this range"
                description="The device hasn't reported during the selected period. Try Latest or a wider range to see its most recent data."
              />
            ) : !plot.device ? (
              <EmptyState
                compact
                icon={Activity}
                title="No monitoring device"
                description="This plot doesn't have a device installed, so there are no sensor readings to show."
              />
            ) : (
              <EmptyState
                compact
                icon={Activity}
                title="No readings yet"
                description="The device hasn't sent any readings yet. Check back once it starts reporting."
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {g.title}
              </h2>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Time</th>
                        <th className="px-4 py-2 font-medium">Soil</th>
                        <th className="px-4 py-2 font-medium">Temp</th>
                        <th className="px-4 py-2 font-medium">Humidity</th>
                        <th className="px-4 py-2 font-medium">Light</th>
                        <th className="px-4 py-2 font-medium">N</th>
                        <th className="px-4 py-2 font-medium">P</th>
                        <th className="px-4 py-2 font-medium">K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                            {r.recordedAt.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: MANILA_TIME_ZONE,
                            })}
                          </td>
                          <td className="px-4 py-2">{fmt(r.soilMoisture, "%")}</td>
                          <td className="px-4 py-2">{fmt(r.temperature, "°C", 1)}</td>
                          <td className="px-4 py-2">{fmt(r.humidity, "%")}</td>
                          <td className="px-4 py-2">{fmt(r.lightIntensity, " lux")}</td>
                          <td className="px-4 py-2">{fmt(r.nitrogen, "")}</td>
                          <td className="px-4 py-2">{fmt(r.phosphorus, "")}</td>
                          <td className="px-4 py-2">{fmt(r.potassium, "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={buildHref(page - 1)}>← Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-400">Page {page}</span>
          {hasNext ? (
            <Button variant="outline" asChild>
              <Link href={buildHref(page + 1)}>Next →</Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

function resolveWindow(
  month: ParsedYearMonth | null,
  range: "7d" | "30d" | null
) {
  if (month) {
    return getAnalyticsDateFilter(month, "all") ?? undefined;
  }
  if (range) {
    return getAnalyticsDateFilter(null, range) ?? undefined;
  }
  return undefined;
}
