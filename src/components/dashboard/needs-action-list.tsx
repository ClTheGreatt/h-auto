"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { ResolveAlertButton } from "@/components/alerts/resolve-alert-button";
import { formatOpenAlertAge } from "@/lib/format-date";
import type { AlertSeverity } from "@prisma/client";

// Keep these small severity presentation maps local; sharing them would turn
// this focused confirmation/copy batch into a broader style refactor.
const severityIcons: Record<AlertSeverity, React.ComponentType<{ className?: string }>> = {
  INFO: Info,
  WARNING: AlertTriangle,
  CRITICAL: AlertCircle,
};

const severityRailClass: Record<AlertSeverity, string> = {
  INFO: "border-l-info-border",
  WARNING: "border-l-warning-border",
  CRITICAL: "border-l-danger-border",
};

const severityTextClass: Record<AlertSeverity, string> = {
  INFO: "text-info-text",
  WARNING: "text-warning-text",
  CRITICAL: "text-danger-text",
};

export type NeedsActionAlert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  createdAt: Date;
  plot: { id: string; name: string };
  isHistorical: boolean;
};

export function NeedsActionList({
  alerts,
  moreCount,
  staleOpenAlertCount,
  canResolve,
}: {
  alerts: NeedsActionAlert[];
  moreCount: number;
  staleOpenAlertCount: number;
  canResolve: boolean;
}) {
  return (
    <div className="space-y-3">
      {staleOpenAlertCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border-l-4 border-l-danger-border bg-danger-bg/40 px-3 py-2 text-sm font-medium text-danger-text">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {staleOpenAlertCount} alert{staleOpenAlertCount === 1 ? "" : "s"} open longer than
          24 hours
        </div>
      )}

      <div className="space-y-2">
        {alerts.map((alert) => {
          const SeverityIcon = severityIcons[alert.severity];
          return (
            <div
              key={alert.id}
              className={`flex items-start justify-between gap-3 border rounded-md border-l-4 p-3 ${severityRailClass[alert.severity]}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{alert.plot.name}</span>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold ${severityTextClass[alert.severity]}`}
                  >
                    <SeverityIcon className="w-3.5 h-3.5" />
                    {alert.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatOpenAlertAge(alert.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {alert.isHistorical ? "Last known: " : ""}
                  {alert.message}
                </p>
              </div>
              {canResolve && (
                <ResolveAlertButton alertId={alert.id} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        {moreCount > 0 ? (
          <Link
            href="/dashboard/alerts"
            className="text-xs font-medium text-foreground hover:underline"
          >
            and {moreCount} more
          </Link>
        ) : (
          <span />
        )}
        <Link
          href="/dashboard/alerts"
          className="text-xs font-medium text-foreground hover:underline inline-flex items-center gap-1"
        >
          View all alerts
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
