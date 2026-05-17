"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = {
  label: string;
  critical: number;
  warning: number;
  info: number;
};

export function AlertsOverTimeChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} stroke="#e5e7eb" />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          stroke="#e5e7eb"
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="critical" name="Critical" stackId="a" fill="#ef4444" />
        <Bar dataKey="warning" name="Warning" stackId="a" fill="#f59e0b" />
        <Bar dataKey="info" name="Info" stackId="a" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}