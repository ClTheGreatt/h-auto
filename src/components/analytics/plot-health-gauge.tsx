"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export function PlotHealthGauge({
  optimalPercent,
}: {
  optimalPercent: number;
}) {
  const data = [
    { name: "Optimal", value: optimalPercent },
    { name: "Out of range", value: 100 - optimalPercent },
  ];

  // Color based on percentage
  let color = "#ef4444"; // red
  if (optimalPercent >= 80) color = "#22c55e"; // green
  else if (optimalPercent >= 50) color = "#f59e0b"; // amber

  return (
    <div className="h-48 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="var(--border)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-3xl font-bold" style={{ color }}>
          {Math.round(optimalPercent)}%
        </div>
        <div className="text-xs text-gray-500 mt-1">Optimal range</div>
      </div>
    </div>
  );
}
