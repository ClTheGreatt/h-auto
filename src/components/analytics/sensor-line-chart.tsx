"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { formatChartDate, type TimeRange } from "@/lib/analytics/time-range";

type Reading = {
  recordedAt: Date;
  value: number | null;
};

type Series = {
  key: string;
  label: string;
  color: string;
  data: Reading[];
};

type SensorLineChartProps = {
  series: Series[];
  range: TimeRange;
  unit: string;
  optimalMin?: number;
  optimalMax?: number;
};

export function SensorLineChart({
  series,
  range,
  unit,
  optimalMin,
  optimalMax,
}: SensorLineChartProps) {
  // Build a unified time-indexed dataset
  const timeMap = new Map<number, Record<string, number | null | string>>();

  for (const s of series) {
    for (const r of s.data) {
      const t = new Date(r.recordedAt).getTime();
      if (!timeMap.has(t)) {
        timeMap.set(t, { time: t });
      }
      timeMap.get(t)![s.key] = r.value;
    }
  }

  const chartData = Array.from(timeMap.values())
    .map((d) => ({
      ...d,
      timeLabel: formatChartDate(new Date(d.time as number), range),
    }))
    .sort((a, b) => (a.time as number) - (b.time as number));

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
        No data for this time range.
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
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            unit={unit}
            width={50}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              backgroundColor: "white",
            }}
            formatter={(value: number) => [`${value}${unit}`, ""]}
          />
          {series.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
          )}
          {optimalMin !== undefined && optimalMax !== undefined && (
            <ReferenceArea
              y1={optimalMin}
              y2={optimalMax}
              fill="#22c55e"
              fillOpacity={0.08}
              stroke="#22c55e"
              strokeOpacity={0.2}
              strokeDasharray="3 3"
            />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}