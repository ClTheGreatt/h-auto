import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  sublabel,
  accent = "green",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sublabel?: string;
  accent?: "green" | "red" | "amber" | "blue" | "gray";
}) {
  const accentColors: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-700",
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {sublabel && (
              <p className="text-xs text-gray-500 mt-1">{sublabel}</p>
            )}
          </div>
          <div className={"p-2 rounded-md " + accentColors[accent]}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}