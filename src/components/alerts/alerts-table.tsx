"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  BellRing,
  Mail,
  MailX,
  Loader2,
  Lightbulb
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
import { EmptyState } from "@/components/ui/empty-state";
import { resolveAlert } from "@/actions/alerts";
import { timeAgo } from "@/lib/format-date";
import type { AlertSeverity, AlertType, NotificationStatus } from "@prisma/client";

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

// Severity is carried by the row container (rail + subtle tint) rather than
// a small colored pill — these map each severity to the token-based classes
// for the rail (left border), the tint (row background), and the text/icon
// color used for the severity label and the suggestion-box icon.
const severityRailClass: Record<AlertSeverity, string> = {
  INFO: "border-l-info-border",
  WARNING: "border-l-warning-border",
  CRITICAL: "border-l-danger-border",
};

const severityTintClass: Record<AlertSeverity, string> = {
  INFO: "bg-info-bg/40",
  WARNING: "bg-warning-bg/40",
  CRITICAL: "bg-danger-bg/40",
};

const severityTextClass: Record<AlertSeverity, string> = {
  INFO: "text-info-text",
  WARNING: "text-warning-text",
  CRITICAL: "text-danger-text",
};

function formatResolvedDate(date: Date): string {
  return new Date(date).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Isolates the Date.now() call in its own non-component function — the
// react-hooks/purity lint rule flags an impure call made directly inside a
// component body, not one tucked behind a helper.
function msSince(date: Date): number {
  return Date.now() - new Date(date).getTime();
}

// Plain-language "how long has this been open" — deliberately a different
// shape from timeAgo's abbreviated "5d ago" (single unit, no "open" prefix):
// this is a distinct signal read next to it, not a replacement for it.
function formatOpenDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  if (minutes < 60) {
    return `open ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `open ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `open ${days}d ${remHours}h` : `open ${days}d`;
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
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function handleResolve(id: string) {
    setResolvingId(id);
    const result = await resolveAlert(id);
    setResolvingId(null);

    if (!result?.success) {
      toast.error("Failed to resolve alert");
      return;
    }
    toast.success("Alert resolved");
    router.refresh();
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

  return (
    <div className="border rounded-md bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Plot</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Notifications</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => {
            const SeverityIcon = severityIcons[alert.severity];
            const sent = alert.notifications.filter((n) => n.status === "SENT").length;
            const failed = alert.notifications.filter((n) => n.status === "FAILED").length;
            const total = alert.notifications.length;
            const isExpanded = expanded === alert.id;

            return (
              <Fragment key={alert.id}>
                <TableRow
                  className={[
                    "border-l-4",
                    severityRailClass[alert.severity],
                    severityTintClass[alert.severity],
                    alert.resolved ? "opacity-60" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setExpanded(isExpanded ? null : alert.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold ${severityTextClass[alert.severity]}`}
                    >
                      <SeverityIcon className="w-4 h-4" />
                      {alert.severity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/plots/${alert.plot.id}`}
                      className="text-sm font-medium hover:underline whitespace-nowrap"
                    >
                      {alert.plot.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 max-w-md">
                    {alert.message}
                    {alert.suggestionTitle && (
                      <div className="mt-3 rounded-md border border-border bg-muted p-3">
                        <div
                          className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${severityTextClass[alert.severity]}`}
                        >
                          <Lightbulb className="h-3.5 w-3.5" />
                          Suggested action
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {alert.suggestionTitle}
                        </div>
                        {alert.suggestionSteps.length > 0 && (
                          <ol className="mt-1.5 list-decimal list-inside space-y-0.5 text-sm text-muted-foreground">
                            {alert.suggestionSteps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {total === 0 ? (
                      <span className="text-xs text-muted-foreground">No recipients</span>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-green-600">
                          <Mail className="w-3 h-3" />
                          {sent}
                        </span>
                        {failed > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <MailX className="w-3 h-3" />
                            {failed}
                          </span>
                        )}
                        <span className="text-gray-400">of {total}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {alert.resolved ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant="secondary"
                          className="bg-muted text-gray-700 w-fit"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Resolved
                        </Badge>
                        {alert.resolvedAt && (
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">
                            {formatResolvedDate(alert.resolvedAt)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-700"
                      >
                        Open
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(alert.createdAt)}
                    {!alert.resolved && (
                      <span className="ml-1.5 text-muted-foreground/70">
                        · {formatOpenDuration(msSince(alert.createdAt))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!alert.resolved && canResolve && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                        disabled={resolvingId === alert.id}
                      >
                        {resolvingId === alert.id ? "Resolving..." : "Resolve"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="bg-muted">
                    <TableCell colSpan={8} className="py-3">
                      <div className="space-y-3 px-2">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            ALERT TYPE
                          </div>
                          <code className="text-xs bg-card px-2 py-0.5 rounded border">
                            {alert.type}
                          </code>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            NOTIFICATION DELIVERY
                          </div>
                          {alert.notifications.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No recipients (no active assignments for this plot)
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
                                    {n.status === "SENT" && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-success-bg text-success-text text-xs"
                                      >
                                        Sent
                                      </Badge>
                                    )}
                                    {n.status === "FAILED" && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-red-100 text-red-700 text-xs"
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
                                        className="text-red-600 text-xs"
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
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
