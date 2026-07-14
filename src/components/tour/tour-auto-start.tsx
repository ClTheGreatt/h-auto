"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTour } from "@/lib/tour";
import { getTourForRole } from "@/lib/tour/role-tour-resolver";

/**
 * Fires the appropriate tour script on first /dashboard mount for users
 * who haven't completed the tour (per DB flag + localStorage cache).
 *
 * Guards:
 * - Only fires once per mount (fired ref)
 * - Only fires when session status === "authenticated" (not loading, not unauthenticated)
 * - Only fires when role has a defined tour
 * - Only fires when isCompleted is false
 * - 500ms delay after mount to let DOM settle
 */
export function TourAutoStart() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { startTour, isCompleted } = useTour();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (status !== "authenticated") return;
    if (!session?.user?.role) return;
    if (isCompleted) return;

    const steps = getTourForRole(session.user.role, router);
    if (!steps) return;

    const timer = setTimeout(() => {
      fired.current = true; // moved INSIDE timeout — cleanup can cancel timer first
      startTour(steps);
    }, 500);

    return () => clearTimeout(timer);
  }, [status, session?.user?.role, isCompleted, router, startTour]);

  return null;
}
