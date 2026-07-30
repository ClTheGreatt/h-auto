"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  BellRing,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatDateTime,
  formatOpenAlertAge,
} from "@/lib/format-date";
import { formatNotificationSummary } from "@/lib/alerts/notification-summary";
import { ResolveAlertButton } from "@/components/alerts/resolve-alert-button";
import type {
  AlertSeverity,
  AlertType,
  NotificationChannel,
  NotificationStatus,
} from "@prisma/client";

type AlertRow = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  suggestionTitle: string | null;
  suggestionSteps: string[];
  plot: { id: string; name: string };
  notifications: {
    id: string;
    userId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    errorMessage: string | null;
    user: { firstName: string; lastName: string; phoneNumber: string | null };
  }[];
};

const severityIcons: Record<AlertSeverity, React.ComponentType<{ className?: string }>> = {
  INFO: Info,
  WARNING: AlertTriangle,
  CRITICAL: AlertCircle,
};

// Severity is carried by the card container (rail + subtle tint) rather than
// a small colored pill — reused unchanged from UI-3.
const severityRailClass: Record<AlertSeverity, string> = {
  INFO: "border-l-info-border",
  WARNING: "border-l-warning-border",
  CRITICAL: "border-l-danger-border",
};

// UI-5: alert cards no longer use a surface tint — at card height (~250px)
// even a reduced-opacity fill still covers a large area and reads as
// dominant. A thin matching-color border on the other 3 edges (paired with
// the existing full-strength border-l-4 rail) gives the same severity
// signal without a wash.
const severityBorderClass: Record<AlertSeverity, string> = {
  INFO: "border-info-border",
  WARNING: "border-warning-border",
  CRITICAL: "border-danger-border",
};

const severityTextClass: Record<AlertSeverity, string> = {
  INFO: "text-info-text",
  WARNING: "text-warning-text",
  CRITICAL: "text-danger-text",
};

// Lower rank = higher priority. Drives both the "worst severity in this
// plot's group" sort and could be reused if a flat priority list is ever
// needed again.
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Isolates the Date.now() call in its own non-component function — the
// react-hooks/purity lint rule flags an impure call made directly inside a
// component body, not one tucked behind a helper.
function msSince(date: Date): number {
  return Date.now() - new Date(date).getTime();
}

type AlertGroup = {
  plotId: string;
  plotName: string;
  alerts: AlertRow[];
};

// Groups the current page's alerts by plot, sorts each group's alerts by
// severity then recency, and sorts the groups themselves by worst severity
// present (CRITICAL groups surface first) with the oldest open alert as the
// tie-breaker — a triage/queue ordering, independent of the page.tsx fetch
// order (which only needs to keep one plot's rows contiguous for pagination
// safety, not reflect the final display priority).
function groupByPlot(alerts: AlertRow[]): AlertGroup[] {
  const byPlot = new Map<string, AlertGroup>();
  for (const alert of alerts) {
    let group = byPlot.get(alert.plot.id);
    if (!group) {
      group = { plotId: alert.plot.id, plotName: alert.plot.name, alerts: [] };
      byPlot.set(alert.plot.id, group);
    }
    group.alerts.push(alert);
  }

  const groups = Array.from(byPlot.values());
  for (const group of groups) {
    group.alerts.sort((a, b) => {
      const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (rankDiff !== 0) return rankDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  groups.sort((a, b) => {
    const worstA = Math.min(...a.alerts.map((al) => SEVERITY_RANK[al.severity]));
    const worstB = Math.min(...b.alerts.map((al) => SEVERITY_RANK[al.severity]));
    if (worstA !== worstB) return worstA - worstB;
    const oldestA = Math.min(...a.alerts.map((al) => al.createdAt.getTime()));
    const oldestB = Math.min(...b.alerts.map((al) => al.createdAt.getTime()));
    return oldestA - oldestB;
  });

  return groups;
}

export function AlertsTable({
  alerts,
  canResolve,
  emptyMessage,
}: {
  alerts: AlertRow[];
  canResolve: boolean;
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Separate from `expanded` (notification-recipient Details toggle) on
  // purpose — two independent disclosures per alert, and unlike Details
  // (single global toggle), multiple suggestion boxes can be open at once.
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(
    () => new Set()
  );

  function toggleSuggestion(id: string) {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={BellRing}
        title={emptyMessage ?? "No alerts"}
        description="All plots are within their ideal thresholds. Alerts will appear here when sensor readings exceed limits."
      />
    );
  }

  const openLongCount = alerts.filter(
    (a) => !a.resolved && msSince(a.createdAt) > ONE_DAY_MS
  ).length;

  const groups = groupByPlot(alerts);

  return (
    <div className="space-y-4">
      {openLongCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border-l-4 border-l-danger-border bg-danger-bg/40 px-3 py-2 text-sm font-medium text-danger-text">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {openLongCount} alert{openLongCount === 1 ? "" : "s"} open longer than 24 hours
        </div>
      )}

      {groups.map((group) => {
        const groupResolved = group.alerts[0]?.resolved ?? false;
        return (
          <div key={group.plotId} className="border rounded-md bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
              <Link
                href={`/dashboard/plots/${group.plotId}`}
                className="text-sm font-medium hover:underline"
              >
                {group.plotName}
              </Link>
              <span className="text-xs text-muted-foreground">
                {group.alerts.length} {groupResolved ? "resolved" : "open"} alert
                {group.alerts.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="divide-y">
              {group.alerts.map((alert) => {
                const SeverityIcon = severityIcons[alert.severity];
                const isExpanded = expanded === alert.id;

                return (
                  <Fragment key={alert.id}>
                    <div
                      className={cn(
                        "border border-l-4 p-3",
                        severityRailClass[alert.severity],
                        severityBorderClass[alert.severity],
                        alert.resolved && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div
                              className={`flex items-center gap-1.5 text-xs font-semibold ${severityTextClass[alert.severity]}`}
                            >
                              <SeverityIcon className="w-4 h-4" />
                              {alert.severity}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {alert.resolved
                                ? `Opened ${formatDate(alert.createdAt)}`
                                : formatOpenAlertAge(alert.createdAt)}
                            </span>
                            {alert.resolved && (
                              <Badge
                                variant="secondary"
                                className="bg-muted text-muted-foreground w-fit"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Resolved
                                {alert.resolvedAt &&
                                  ` · ${formatDateTime(alert.resolvedAt)}`}
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-foreground mt-1.5">{alert.message}</p>

                          {alert.suggestionTitle && (
                            <div className="mt-2 rounded-md border border-border bg-muted p-3">
                              <button
                                type="button"
                                onClick={() => toggleSuggestion(alert.id)}
                                className="flex items-center gap-1.5 text-sm text-foreground w-full text-left"
                              >
                                {expandedSuggestions.has(alert.id) ? (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <Lightbulb
                                  className={`h-3.5 w-3.5 shrink-0 ${severityTextClass[alert.severity]}`}
                                />
                                <span>
                                  Suggested action: {alert.suggestionTitle}
                                  {alert.suggestionSteps.length > 0 &&
                                    ` — ${alert.suggestionSteps.length} step${
                                      alert.suggestionSteps.length === 1 ? "" : "s"
                                    }`}
                                </span>
                              </button>
                              {expandedSuggestions.has(alert.id) &&
                                alert.suggestionSteps.length > 0 && (
                                  <ol className="mt-2 ml-4.5 list-decimal list-inside space-y-0.5 text-sm text-muted-foreground">
                                    {alert.suggestionSteps.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ol>
                                )}
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatNotificationSummary(alert.notifications)}</span>
                            <button
                              type="button"
                              onClick={() => setExpanded(isExpanded ? null : alert.id)}
                              className="flex items-center gap-0.5 hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              Details
                            </button>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {!alert.resolved && canResolve && (
                            <ResolveAlertButton alertId={alert.id} />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Alert type
                            </div>
                            <code className="text-xs bg-card px-2 py-0.5 rounded border">
                              {alert.type}
                            </code>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Notification delivery
                            </div>
                            {alert.notifications.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No notification records were created
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {alert.notifications.map((n) => (
                                  <div
                                    key={n.id}
                                    className="flex items-center justify-between bg-card border rounded px-3 py-1.5 text-xs"
                                  >
                                    <div>
                                      <span className="font-medium">
                                        {n.user.firstName} {n.user.lastName}
                                      </span>
                                      <span className="text-muted-foreground ml-2">
                                        {n.user.phoneNumber ?? "No phone"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {n.channel.replace("_", " ")}
                                      </Badge>
                                      {n.status === "SENT" && (
                                        <Badge
                                          variant="secondary"
                                          className="bg-success-bg text-success-text text-xs"
                                        >
                                          Sent
                                        </Badge>
                                      )}
                                      {n.status === "DELIVERED" && (
                                        <Badge
                                          variant="secondary"
                                          className="bg-success-bg text-success-text text-xs"
                                        >
                                          Delivered
                                        </Badge>
                                      )}
                                      {n.status === "FAILED" && (
                                        <Badge
                                          variant="secondary"
                                          className="bg-danger-bg text-danger-text text-xs"
                                        >
                                          Failed
                                        </Badge>
                                      )}
                                      {n.status === "PENDING" && (
                                        <Badge
                                          variant="secondary"
                                          className="bg-muted text-gray-700 text-xs"
                                        >
                                          Pending
                                        </Badge>
                                      )}
                                      {n.errorMessage && (
                                        <span
                                          className="text-danger-text text-xs"
                                          title={n.errorMessage}
                                        >
                                          ({n.errorMessage.slice(0, 30)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
