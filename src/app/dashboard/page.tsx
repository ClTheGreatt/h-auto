import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import {
  Sprout,
  Camera,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { timeAgo, formatDate, formatDateTime } from "@/lib/format-date";
import { isDeviceOnline } from "@/lib/utils/device-status";
import { getThresholdStatus, SENSOR_FIELDS } from "@/lib/sensors/threshold-status";
import { NeedsActionList, type NeedsActionAlert } from "@/components/dashboard/needs-action-list";
import type { AlertSeverity, AlertType, PlotStatus } from "@prisma/client";

const OBSERVATION_TRUNCATE_LENGTH = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors the identical list in src/app/dashboard/plots/page.tsx — not
// exported from there (page files shouldn't grow arbitrary named exports),
// so duplicated here rather than refactoring that unrelated page.
const ACTIVE_STATUSES: PlotStatus[] = [
  "PREPARING",
  "PLANTED",
  "GROWING",
  "READY_FOR_HARVEST",
];

// Vegetative/Harvest deliberately avoid green/amber — this file's grep check
// (Step 8) requires zero red/amber/yellow/green/emerald matches anywhere in
// this file, since those 5 hues are reserved for severity tokens now.
// Germination/Seedling/Flowering/Fruiting keep their original decorative
// hues (lime/pink/orange aren't in the reserved set).
const STAGE_BADGE_COLORS: Record<string, string> = {
  Germination: "bg-lime-100 text-lime-700",
  Seedling: "bg-lime-100 text-lime-700",
  Vegetative: "bg-teal-100 text-teal-700",
  Flowering: "bg-pink-100 text-pink-700",
  Fruiting: "bg-orange-100 text-orange-700",
  Harvest: "bg-stone-100 text-stone-700",
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

type PlotCondition = "CRITICAL" | "WARNING" | "NO_DATA" | "ALL_IN_RANGE";

const CONDITION_LABEL: Record<PlotCondition, string> = {
  CRITICAL: "Critical",
  WARNING: "Warning",
  NO_DATA: "No data",
  ALL_IN_RANGE: "All in range",
};

const CONDITION_TEXT_CLASS: Record<PlotCondition, string> = {
  CRITICAL: "text-danger-text",
  WARNING: "text-warning-text",
  NO_DATA: "text-muted-foreground",
  ALL_IN_RANGE: "text-success-text",
};

const CONDITION_BORDER_CLASS: Record<PlotCondition, string> = {
  CRITICAL: "border-l-danger-border",
  WARNING: "border-l-warning-border",
  NO_DATA: "border-l-border",
  ALL_IN_RANGE: "border-l-success-border",
};

const CONDITION_ICON: Record<PlotCondition, React.ComponentType<{ className?: string }>> = {
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  NO_DATA: WifiOff,
  ALL_IN_RANGE: CheckCircle2,
};

// Short plain-language verdict per alert type — drives the attention
// summary's "{plot} {verdict}" phrases, e.g. "Eggplant Plot A1 is dry".
const ALERT_TYPE_VERDICT: Record<AlertType, string> = {
  LOW_SOIL_MOISTURE: "is dry",
  HIGH_SOIL_MOISTURE: "is waterlogged",
  LOW_TEMPERATURE: "is too cold",
  HIGH_TEMPERATURE: "is too hot",
  LOW_HUMIDITY: "has low humidity",
  HIGH_HUMIDITY: "has high humidity",
  LOW_LIGHT: "needs more light",
  HIGH_LIGHT: "is getting too much light",
  LOW_NITROGEN: "is low on nitrogen",
  HIGH_NITROGEN: "has excess nitrogen",
  LOW_PHOSPHORUS: "is low on phosphorus",
  HIGH_PHOSPHORUS: "has excess phosphorus",
  LOW_POTASSIUM: "is low on potassium",
  HIGH_POTASSIUM: "has excess potassium",
  DEVICE_OFFLINE: "has no data (device offline)",
};

// Short column labels, matching the existing convention in
// src/app/dashboard/plots/[id]/readings/page.tsx's history table.
const SHORT_FIELD_LABEL: Record<string, string> = {
  soilMoisture: "Soil",
  temperature: "Temp",
  humidity: "Humidity",
  lightIntensity: "Light",
  nitrogen: "N",
  phosphorus: "P",
  potassium: "K",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function daysAgoLabel(date: Date, nowMs: number): string {
  const days = Math.floor((nowMs - date.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// Same wording as the plot detail page's stale-data line (UI-2).
function formatStaleDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function StripItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="hover:underline">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function DashboardPage() {
  // Mark this as dynamic - required for impure functions like Date.now()
  await connection();

  const session = await requireAuth();
  const role = session.user.role;
  const userId = session.user.id;

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isFaculty = role === "FACULTY";
  const isStudent = role === "STUDENT_FARMER";
  const canResolve = isAdmin || isFaculty;

  // Capture "now" once after connection() marker
  const now = new Date();
  const nowMs = now.getTime();
  const oneWeekAgo = new Date(nowMs - 7 * DAY_MS);

  // Role-aware plot filter
  const plotFilter = isStudent
    ? {
        assignments: {
          some: { studentId: userId, status: "ACTIVE" as const },
        },
      }
    : isFaculty
    ? { facultyId: userId }
    : {};

  const [userCount, activeAssignmentCount, recentLogCount, recentLogs, plots] =
    await Promise.all([
      isAdmin ? prisma.user.count({ where: { status: "ACTIVE" } }) : Promise.resolve(0),
      prisma.plotAssignment.count({
        where: {
          status: "ACTIVE",
          ...(isStudent ? { studentId: userId } : {}),
          ...(isFaculty ? { facultyId: userId } : {}),
        },
      }),
      prisma.growthLog.count({
        where: { createdAt: { gte: oneWeekAgo }, plot: plotFilter },
      }),
      prisma.growthLog.findMany({
        where: { plot: plotFilter },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          plot: { select: { id: true, name: true } },
          user: { select: { firstName: true, lastName: true, profileImage: true } },
          stage: { select: { name: true } },
          images: { take: 1, orderBy: { createdAt: "asc" }, select: { imageUrl: true } },
        },
      }),
      // The single source of truth for the attention summary, plot cards,
      // needs-action list, escalation line, and counts strip below — see
      // Step 1(d)/(e) findings: none of this was queried before, so it's
      // added here once rather than issuing a query per card.
      prisma.plot.findMany({
        where: { ...plotFilter, status: { in: ACTIVE_STATUSES } },
        orderBy: { name: "asc" },
        include: {
          crop: { select: { name: true, variety: true, daysToHarvest: true } },
          currentStage: true,
          device: { select: { id: true, deviceCode: true, lastSeenAt: true } },
          alerts: {
            where: { resolved: false },
            select: { id: true, severity: true, type: true, message: true, createdAt: true },
          },
          sensorReadings: { orderBy: { recordedAt: "desc" }, take: 1 },
        },
      }),
    ]);

  const allOpenAlerts = plots
    .flatMap((p) =>
      p.alerts.map((a) => ({ ...a, plot: { id: p.id, name: p.name } }))
    )
    .sort((a, b) => {
      const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (rankDiff !== 0) return rankDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const needsActionAlerts: NeedsActionAlert[] = allOpenAlerts.slice(0, 5);
  const moreAlertsCount = Math.max(0, allOpenAlerts.length - needsActionAlerts.length);
  const staleOpenAlertCount = allOpenAlerts.filter(
    (a) => nowMs - a.createdAt.getTime() > DAY_MS
  ).length;
  const criticalCount = allOpenAlerts.filter((a) => a.severity === "CRITICAL").length;
  const warningCount = allOpenAlerts.filter((a) => a.severity === "WARNING").length;

  // Only queried when there truly are zero open alerts across every active
  // plot — keeps the common (alerts present) path from paying for it.
  const recentlyResolvedAlert =
    allOpenAlerts.length === 0
      ? await prisma.alert.findFirst({
          where: { resolved: true, resolvedAt: { gte: oneWeekAgo }, plot: plotFilter },
          orderBy: { resolvedAt: "desc" },
          select: { resolvedAt: true },
        })
      : null;

  const moreLogsThisWeek = Math.max(0, recentLogCount - recentLogs.length);

  const plotsWithDevice = plots.filter((p) => p.device);
  const devicesOnlineCount = plotsWithDevice.filter((p) =>
    isDeviceOnline(p.device!.lastSeenAt)
  ).length;
  const devicesOfflineCount = plotsWithDevice.length - devicesOnlineCount;
  const mostRecentSeenAt = plotsWithDevice.reduce<Date | null>((latest, p) => {
    const seen = p.device!.lastSeenAt;
    if (!seen) return latest;
    return !latest || seen > latest ? seen : latest;
  }, null);
  const allDevicesOnline = plotsWithDevice.length > 0 && devicesOfflineCount === 0;

  // Single source of truth for "does this plot need attention" — shared by
  // the card badge, the attention summary, and the counts strip so all
  // three agree. A plot the system can't currently monitor (no stage, no
  // device, or a device that's offline / has never reported) counts as
  // needing attention just as much as one with a real open alert — it isn't
  // "in range", it's blind, and treating it as fine let it silently vanish
  // from both the summary and the strip.
  const plotsWithCondition = plots.map((plot) => {
    const condition: PlotCondition = plot.alerts.some((a) => a.severity === "CRITICAL")
      ? "CRITICAL"
      : plot.alerts.some((a) => a.severity === "WARNING")
      ? "WARNING"
      : !plot.currentStage ||
        !plot.device ||
        plot.sensorReadings.length === 0 ||
        !isDeviceOnline(plot.device.lastSeenAt)
      ? "NO_DATA"
      : "ALL_IN_RANGE";
    return { ...plot, condition };
  });

  const attentionPlots = plotsWithCondition.filter((p) => p.condition !== "ALL_IN_RANGE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Today</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(now)}
            {plotsWithDevice.length === 0
              ? " · no devices registered"
              : allDevicesOnline
              ? " · all sensors reporting"
              : mostRecentSeenAt
              ? ` · sensors last reported ${timeAgo(mostRecentSeenAt)}`
              : " · sensors have not reported yet"}
          </p>
        </div>
        <Badge variant="secondary" className="bg-muted text-muted-foreground capitalize">
          {role.toLowerCase().replace("_", " ")}
        </Badge>
      </div>

      {/* Attention summary */}
      <div
        className={cn(
          "border rounded-md bg-card border-l-4 p-4",
          attentionPlots.length > 0
            ? CONDITION_BORDER_CLASS.CRITICAL
            : CONDITION_BORDER_CLASS.ALL_IN_RANGE
        )}
      >
        {attentionPlots.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-foreground">
              {attentionPlots.length} plot{attentionPlots.length === 1 ? "" : "s"}{" "}
              {attentionPlots.length === 1 ? "needs" : "need"} attention
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {attentionPlots
                .map((p) => {
                  if (p.alerts.length > 0) {
                    const worst = [...p.alerts].sort(
                      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
                    )[0];
                    return `${p.name} ${ALERT_TYPE_VERDICT[worst.type]}`;
                  }
                  if (!p.currentStage) return `${p.name} has no growth stage set`;
                  if (!p.device) return `${p.name} has no device linked`;
                  return `${p.name} ${ALERT_TYPE_VERDICT.DEVICE_OFFLINE}`;
                })
                .join(" · ")}
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-success-text">All plots are in range</p>
        )}
        {(criticalCount > 0 || warningCount > 0 || devicesOfflineCount > 0) && (
          <p className="text-xs text-muted-foreground mt-2">
            {[
              criticalCount > 0 && `${criticalCount} critical`,
              warningCount > 0 && `${warningCount} warning`,
              devicesOfflineCount > 0 &&
                `${devicesOfflineCount} device${devicesOfflineCount === 1 ? "" : "s"} offline`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {/* Counts strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-card px-4 py-3">
        <StripItem
          href="/dashboard/plots"
          label="Plots"
          value={`${attentionPlots.length} of ${plots.length} ${
            attentionPlots.length === 1 ? "needs" : "need"
          } attention`}
        />
        <StripItem
          href={isAdmin ? "/dashboard/devices" : undefined}
          label="Devices"
          value={`${devicesOnlineCount} of ${plotsWithDevice.length} reporting`}
        />
        <StripItem
          href="/dashboard/alerts"
          label="Alerts"
          value={
            allOpenAlerts.length === 0
              ? "0 open"
              : `${allOpenAlerts.length} open${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}`
          }
        />
        <StripItem
          href="/dashboard/monitoring"
          label="Logs"
          value={`${recentLogCount} this week`}
        />
        <StripItem
          href={isAdmin ? "/dashboard/users" : "/dashboard/assignments"}
          label={isAdmin ? "Users" : "Assignments"}
          value={isAdmin ? `${userCount} active` : `${activeAssignmentCount} active`}
        />
      </div>

      {/* Plot cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plots</CardTitle>
        </CardHeader>
        <CardContent>
          {plotsWithCondition.length === 0 ? (
            <EmptyState icon={Sprout} title="No active plots" compact />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {plotsWithCondition.map((plot) => {
                const { condition } = plot;
                const ConditionIcon = CONDITION_ICON[condition];

                const daysSincePlanting = plot.plantingDate
                  ? Math.floor((nowMs - plot.plantingDate.getTime()) / DAY_MS)
                  : null;
                const dayLabel =
                  daysSincePlanting != null && plot.crop?.daysToHarvest
                    ? `Day ${Math.min(
                        Math.max(1, daysSincePlanting + 1),
                        plot.crop.daysToHarvest
                      )} of ${plot.crop.daysToHarvest}`
                    : null;

                const reading = plot.sensorReadings[0] ?? null;
                const deviceOnline = plot.device ? isDeviceOnline(plot.device.lastSeenAt) : false;
                const isStale = !!reading && !!plot.device && !deviceOnline;

                return (
                  <div
                    key={plot.id}
                    className={cn(
                      "border rounded-md bg-card p-4 border-l-4",
                      CONDITION_BORDER_CLASS[condition]
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/plots/${plot.id}`}
                          className="font-medium text-sm hover:underline"
                        >
                          {plot.name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {plot.crop
                            ? `${plot.crop.name}${plot.crop.variety ? ` (${plot.crop.variety})` : ""}`
                            : "No crop planted"}
                          {plot.currentStage && ` · ${plot.currentStage.name}`}
                          {dayLabel && ` · ${dayLabel}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs font-semibold shrink-0",
                          CONDITION_TEXT_CLASS[condition]
                        )}
                      >
                        <ConditionIcon className="w-3.5 h-3.5" />
                        {CONDITION_LABEL[condition]}
                      </span>
                    </div>

                    {!plot.currentStage && (
                      <p className="text-xs text-muted-foreground italic mt-2">
                        No growth stage set — thresholds and alerts are off.{" "}
                        <Link href={`/dashboard/plots/${plot.id}/edit`} className="underline">
                          Set stage
                        </Link>
                      </p>
                    )}

                    <div className="mt-2">
                      {!reading ? (
                        <p className="text-xs text-muted-foreground">
                          {!plot.device ? "No device linked" : "Awaiting first reading"}
                        </p>
                      ) : (
                        <div
                          className={cn(
                            "flex flex-wrap gap-x-3 gap-y-1 text-xs",
                            isStale && "opacity-60"
                          )}
                        >
                          {SENSOR_FIELDS.map((field) => {
                            const value = reading[field.key];
                            if (value == null) return null;
                            const status = plot.currentStage
                              ? getThresholdStatus(
                                  value,
                                  plot.currentStage[field.minField],
                                  plot.currentStage[field.maxField]
                                )
                              : null;
                            return (
                              <span
                                key={field.key}
                                className={
                                  status == null
                                    ? "text-muted-foreground"
                                    : status === "optimal"
                                    ? "text-success-text"
                                    : "text-danger-text"
                                }
                              >
                                {SHORT_FIELD_LABEL[field.key]} {value}
                                {field.unit}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {isStale && reading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        No data for {formatStaleDuration(nowMs - reading.recordedAt.getTime())}
                        {" · "}Last reading {formatDateTime(reading.recordedAt)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Needs-action list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              Needs action
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/alerts">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allOpenAlerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success-bg mb-3">
                <CheckCircle2 className="w-7 h-7 text-success-text" />
              </div>
              <h3 className="text-sm font-medium text-foreground">No open alerts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {recentlyResolvedAlert?.resolvedAt
                  ? `Last alert resolved ${daysAgoLabel(recentlyResolvedAlert.resolvedAt, nowMs)}`
                  : "All plots within optimal range."}
              </p>
              <div className="mt-3 text-right">
                <Link
                  href="/dashboard/alerts?status=resolved"
                  className="text-xs font-medium text-foreground hover:underline"
                >
                  View alert history →
                </Link>
              </div>
            </div>
          ) : (
            <NeedsActionList
              alerts={needsActionAlerts}
              moreCount={moreAlertsCount}
              staleOpenAlertCount={staleOpenAlertCount}
              canResolve={canResolve}
            />
          )}
        </CardContent>
      </Card>

      {/* Recent observations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Recent observations
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/monitoring">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <EmptyState icon={Camera} title="No growth logs yet" compact />
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => {
                const initials =
                  `${log.user.firstName[0]}${log.user.lastName[0]}`.toUpperCase();
                const stageColor = log.stage
                  ? STAGE_BADGE_COLORS[log.stage.name] ?? "bg-muted text-muted-foreground"
                  : null;
                const thumbnail = log.images[0]?.imageUrl;
                return (
                  <Link
                    key={log.id}
                    href={`/dashboard/plots/${log.plot.id}`}
                    className="flex items-start gap-3 p-2 -mx-2 rounded hover:bg-muted transition"
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      {log.user.profileImage && (
                        <AvatarImage src={log.user.profileImage} alt="" />
                      )}
                      <AvatarFallback className="bg-muted text-foreground text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">
                          {log.user.firstName} {log.user.lastName}
                        </span>
                        <span className="text-muted-foreground">logged</span>
                        <span className="font-medium text-foreground">{log.plot.name}</span>
                        {log.stage && (
                          <Badge
                            variant="secondary"
                            className={`text-xs h-5 ${stageColor}`}
                          >
                            {log.stage.name}
                          </Badge>
                        )}
                      </div>
                      {log.observations && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {truncate(log.observations, OBSERVATION_TRUNCATE_LENGTH)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {timeAgo(log.createdAt)}
                      </p>
                    </div>
                    {thumbnail && (
                      <Image
                        src={thumbnail}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-md object-cover shrink-0"
                      />
                    )}
                  </Link>
                );
              })}
              {moreLogsThisWeek > 0 && (
                <p className="text-xs text-muted-foreground/70 text-center pt-1">
                  {moreLogsThisWeek} more observation{moreLogsThisWeek === 1 ? "" : "s"} this
                  week
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
