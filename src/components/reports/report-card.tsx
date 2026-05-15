"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
  Activity,
  Sprout,
  Camera,
  BellRing,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIME_RANGES, type TimeRange } from "@/lib/analytics/time-range";
import type { LucideIcon } from "lucide-react";

const ALL_PLOTS = "__all_plots__";

// Map string identifiers to actual Lucide icon components
const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  sprout: Sprout,
  camera: Camera,
  bellring: BellRing,
  filetext: FileText,
};

type Plot = { id: string; name: string };

export function ReportCard({
  type,
  title,
  description,
  icon,
  iconColor,
  plots,
}: {
  type: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  plots?: Plot[];
}) {
  const [range, setRange] = useState<TimeRange>("7d");
  const [plotId, setPlotId] = useState<string>(ALL_PLOTS);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  const Icon = ICONS[icon] ?? Activity;

  async function handleDownload(format: "pdf" | "excel") {
    setDownloading(format);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      params.set("range", range);
      if (plots && plotId !== ALL_PLOTS) {
        params.set("plotId", plotId);
      }

      const response = await fetch(`/api/reports/${type}?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      a.download = match?.[1] || `report.${format === "pdf" ? "pdf" : "xlsx"}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${title} ${format.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate report"
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className={"p-2 rounded-md " + iconColor}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${type}-range`} className="text-xs">
              Time range
            </Label>
            <Select
              value={range}
              onValueChange={(v) => setRange(v as TimeRange)}
            >
              <SelectTrigger id={`${type}-range`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {plots && (
            <div>
              <Label htmlFor={`${type}-plot`} className="text-xs">
                Plot
              </Label>
              <Select value={plotId} onValueChange={setPlotId}>
                <SelectTrigger id={`${type}-plot`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PLOTS}>All plots</SelectItem>
                  {plots.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null}
            className="flex-1"
          >
            {downloading === "pdf" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("excel")}
            disabled={downloading !== null}
            className="flex-1"
          >
            {downloading === "excel" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}