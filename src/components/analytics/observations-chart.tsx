"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = { label: string; count: number };

export function ObservationsChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} stroke="#e5e7eb" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} stroke="#e5e7eb" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="count" name="Observations" fill="#16a34a" maxBarSize={48} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}