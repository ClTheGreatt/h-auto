"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

type AlertTypeCount = {
  type: string;
  label: string;
  count: number;
  severity: "WARNING" | "CRITICAL" | "INFO";
};

export function AlertsByTypeChart({ data }: { data: AlertTypeCount[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
        No alerts in this time range.
      </div>
    );
  }

  // Sort by count descending
  const sorted = [...data].sort((a, b) => b.count - a.count);

  const colorMap = {
    WARNING: "#f59e0b",
    CRITICAL: "#ef4444",
    INFO: "#3b82f6",
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            type="number"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              backgroundColor: "white",
            }}
            cursor={{ fill: "#f9fafb" }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={colorMap[entry.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}