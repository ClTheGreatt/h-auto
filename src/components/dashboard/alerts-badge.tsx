"use client";

import { useEffect, useState } from "react";

export function AlertsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/alerts/count");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setCount(data.open ?? 0);
      } catch {
        // best-effort — huwag i-block ang nav
      }
    }
    load();
    const id = setInterval(load, 10000); // live
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}