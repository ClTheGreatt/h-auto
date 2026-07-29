"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveAlert } from "@/actions/alerts";
import type { AlertSeverity } from "@prisma/client";

// Duplicated from src/components/alerts/alerts-table.tsx rather than shared
// — that file is out of scope for this batch, and these are a handful of
// small, stable token maps/helpers, not worth a cross-cutting refactor here.
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

function msSince(date: Date): number {
  return Date.now() - new Date(date).getTime();
}

function formatOpenDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  if (minutes < 60) return `open ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `open ${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `open ${days}d ${remHours}h` : `open ${days}d`;
}

export type NeedsActionAlert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  createdAt: Date;
  plot: { id: string; name: string };
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
  const router = useRouter();
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
                    {formatOpenDuration(msSince(alert.createdAt))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {alert.message}
                </p>
              </div>
              {canResolve && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolvingId === alert.id}
                  className="shrink-0"
                >
                  {resolvingId === alert.id ? "Resolving..." : "Resolve"}
                </Button>
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
