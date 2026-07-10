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

  // No visible output — this is a background auto-refresh timer. The
  // actual device/reading status is shown by a single, accurate badge
  // in the parent (computed from lastSeenAt), so this used to render a
  // hardcoded "Live" label that misleadingly sat next to an "OFFLINE"
  // badge even when the device wasn't actually online.
  return null;
}