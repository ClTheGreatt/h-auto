"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatChartDate, type TimeRange } from "@/lib/analytics/time-range";

type GrowthLog = {
  createdAt: Date;
  plantHeightCm: number | null;
  leafCount: number | null;
};

export function GrowthProgressionChart({
  logs,
  range,
}: {
  logs: GrowthLog[];
  range: TimeRange;
}) {
  const chartData = logs
    .map((log) => ({
      time: new Date(log.createdAt).getTime(),
      timeLabel: formatChartDate(new Date(log.createdAt), range),
      height: log.plantHeightCm,
      leaves: log.leafCount,
    }))
    .sort((a, b) => a.time - b.time);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
        No growth logs in this time range.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="timeLabel"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#22c55e"
            fontSize={11}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#3b82f6"
            fontSize={11}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              backgroundColor: "white",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="height"
            name="Height (cm)"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="leaves"
            name="Leaf count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}