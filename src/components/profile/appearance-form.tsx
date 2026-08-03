"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Classic bright look",
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
    description: "Easier on the eyes at night",
  },
  {
    value: "system",
    label: "System",
    icon: Laptop,
    description: "Match your device settings",
  },
] as const;

// useSyncExternalStore (not useState+useEffect) so this client/server
// mounted guard doesn't trip the react-hooks/set-state-in-effect lint rule
// — same technique as src/components/ui/theme-toggle.tsx.
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how H-Auto looks. Pick a theme or match your device.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const isActive = mounted && theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left",
                  isActive
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-md flex items-center justify-center transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
