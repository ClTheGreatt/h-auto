"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { TourStep } from "./types";
import { isTourCompleted, markTourCompleted, resetTour } from "./storage";
import { createTourDriver } from "./driver-config";
import { markTourCompletedAction, resetTourAction } from "@/actions/tour";

type TourContextValue = {
  startTour: (steps: TourStep[]) => void;
  resetAndRestart: (steps: TourStep[]) => void;
  isCompleted: boolean;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

// useSyncExternalStore (not useState+useEffect) so reading localStorage after
// mount doesn't trip the react-hooks/set-state-in-effect lint rule. Snapshot
// is the real per-user "completed" flag once mounted; false before/without a user.
function useLocalCompleted(userId: string | undefined) {
  return useSyncExternalStore(
    () => () => {},
    () => (userId ? isTourCompleted(userId) : false),
    () => false
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const serverCompletedAt = session?.user?.tourCompletedAt ?? null;

  const localCompleted = useLocalCompleted(userId);
  const [isCompleted, setIsCompleted] = useState(false);

  // Server truth → localStorage, so a tour already completed (e.g. on another
  // device, or before this browser's localStorage existed) doesn't fire again
  // once the session/JWT reflects it here.
  useEffect(() => {
    if (!userId) return;
    if (serverCompletedAt && !isTourCompleted(userId)) {
      markTourCompleted(userId);
    }
  }, [userId, serverCompletedAt]);

  const startTour = useCallback(
    (steps: TourStep[]) => {
      if (!userId) {
        console.warn("[tour] startTour called with no signed-in user");
        return;
      }

      const onComplete = async () => {
        markTourCompleted(userId); // localStorage — instant
        await markTourCompletedAction(); // DB — persistent, fire-and-forget errors already logged
        setIsCompleted(true);
      };

      const tourDriver = createTourDriver(steps, () => {
        void onComplete();
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
      resetTour(userId); // localStorage
      void resetTourAction(); // DB — fire-and-forget, errors already logged
      setIsCompleted(false);
      startTour(steps);
    },
    [userId, startTour]
  );

  return (
    <TourContext.Provider
      value={{
        startTour,
        resetAndRestart,
        isCompleted: isCompleted || localCompleted || !!serverCompletedAt,
      }}
    >
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
