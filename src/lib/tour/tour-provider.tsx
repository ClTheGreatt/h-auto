"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { TourStep } from "./types";
import { isTourCompleted, markTourCompleted, resetTour } from "./storage";
import { createTourDriver } from "./driver-config";

type TourContextValue = {
  startTour: (steps: TourStep[]) => void;
  resetAndRestart: (steps: TourStep[]) => void;
  isCompleted: boolean;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

// useSyncExternalStore (not useState+useEffect) so reading localStorage after
// mount doesn't trip the react-hooks/set-state-in-effect lint rule.
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const mounted = useMounted();

  // Bumped after markTourCompleted/resetTour to force isCompleted to
  // re-read localStorage; it holds no data of its own.
  const [, forceRecompute] = useState(0);

  const isCompleted = mounted && userId ? isTourCompleted(userId) : false;

  const startTour = useCallback(
    (steps: TourStep[]) => {
      if (!userId) {
        console.warn("[tour] startTour called with no signed-in user");
        return;
      }
      const tourDriver = createTourDriver(steps, () => {
        markTourCompleted(userId);
        forceRecompute((n) => n + 1);
      });
      tourDriver.drive();
    },
    [userId]
  );

  const resetAndRestart = useCallback(
    (steps: TourStep[]) => {
      if (!userId) {
        console.warn("[tour] resetAndRestart called with no signed-in user");
        return;
      }
      resetTour(userId);
      forceRecompute((n) => n + 1);
      startTour(steps);
    },
    [userId, startTour]
  );

  return (
    <TourContext.Provider value={{ startTour, resetAndRestart, isCompleted }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return ctx;
}
