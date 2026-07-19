"use client";

import { scorePasswordStrength } from "@/lib/validations/password";

type Props = { password: string };

export function PasswordStrengthIndicator({ password }: Props) {
  if (!password) return null;

  const { score, label, color } = scorePasswordStrength(password);

  const colorClass = {
    red: "bg-red-500",
    orange: "bg-orange-500",
    yellow: "bg-yellow-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
  }[color];

  const textColorClass = {
    red: "text-red-600",
    orange: "text-orange-600",
    yellow: "text-yellow-600",
    blue: "text-blue-600",
    green: "text-green-600",
  }[color];

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${
              i < score ? colorClass : "bg-muted"
            } transition-colors`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className={`font-medium ${textColorClass}`}>{label}</span>
      </p>
    </div>
  );
}
