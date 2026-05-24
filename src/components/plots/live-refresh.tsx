"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [active, setActive] = useState(true);

  // Pause polling when the tab is hidden (saves resources)
  useEffect(() => {
    function onVisibility() {
      setActive(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);

  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}