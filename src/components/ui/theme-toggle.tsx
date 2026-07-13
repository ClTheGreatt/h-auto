"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// useSyncExternalStore (not useState+useEffect) so the client/server-mismatch
// guard below doesn't trip the react-hooks/set-state-in-effect lint rule.
function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// Quick-access light/dark flip for the navbar. Resolves "system" to its
// current rendered value so a two-icon toggle always has a sensible state;
// the full Light/Dark/System picker still lives on the profile page
// (src/components/profile/appearance-form.tsx).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Toggle theme">
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </Button>
  );
}
