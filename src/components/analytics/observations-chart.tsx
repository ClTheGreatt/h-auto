"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  type MouseHandlerDataParam,
} from "recharts";
import { X, Calendar, MapPin, Loader2, Sprout, ChevronRight } from "lucide-react";
import { getObservationsForDate } from "@/actions/analytics";

type DataPoint = { label: string; count: number; date: number };

type LogRow = {
  id: string;
  observations: string | null;
  createdAt: string;
  userName: string;
  plotName: string;
  plotId: string;
  stageName: string | null;
  day: string;
};

export function ObservationsChart({
  data,
  bucketMs,
  plotId,
}: {
  data: DataPoint[];
  bucketMs: number;
  plotId?: string;
}) {
  const [selected, setSelected] = useState<{ label: string } | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleChartClick(state: MouseHandlerDataParam) {
    if (state.activeIndex == null) return;
    const point = data[Number(state.activeIndex)];
    if (!point || point.count === 0) return;
    setSelected({ label: point.label });
    setLogs(null);
    setLoading(true);
    try {
      const result = await getObservationsForDate(point.date, bucketMs, plotId);
      setLogs(result);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setSelected(null);
    setLogs(null);
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          onClick={handleChartClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
            }}
          />
          <Bar
            dataKey="count"
            name="Observations"
            fill="var(--chart-1)"
            maxBarSize={48}
            radius={[4, 4, 0, 0]}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-center text-xs text-gray-400 mt-2">
        Click a bar to see who logged on that date.
      </p>

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-foreground">
                  Observations on {selected.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-3">
              {loading && (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}

              {!loading && logs && logs.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No observations found.
                </div>
              )}

              {!loading && logs && logs.length > 0 && (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <Link
                      key={log.id}
                      href={{
                        pathname: "/dashboard/monitoring",
                        query: { date: log.day, plotId: log.plotId },
                      }}
                      onClick={close}
                      className="block border rounded-md p-3 hover:bg-muted transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {log.userName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(log.createdAt).toLocaleTimeString("en-PH", {
                            timeZone: "Asia/Manila",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {log.plotName}
                        {log.stageName && (
                          <span className="flex items-center gap-1">
                            <Sprout className="w-3 h-3" />
                            {log.stageName}
                          </span>
                        )}
                      </div>
                      {log.observations && (
                        <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">
                          {log.observations}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {!loading && logs && logs.length > 0 && (
              <div className="border-t px-5 py-3">
                <Link
                  href={{
                    pathname: "/dashboard/monitoring",
                    query: {
                      date: logs[0].day,
                      ...(plotId && { plotId }),
                    },
                  }}
                  onClick={close}
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
                >
                  View all in Monitoring
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
