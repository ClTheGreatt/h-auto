"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { TourStep } from "./types";
import { isTourCompleted, markTourCompleted, resetTour } from "./storage";
import { createTourDriver } from "./driver-config";
import { markTourCompletedAction, resetTourAction } from "@/actions/tour";
import { SkipConfirmationDialog } from "@/components/tour/skip-confirmation-dialog";

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
  const [pendingSkip, setPendingSkip] = useState(false);
  const currentDriverRef = useRef<ReturnType<typeof createTourDriver> | null>(null);
  const savedTourState = useRef<{ steps: TourStep[]; index: number } | null>(null);

  // Server truth → localStorage, so a tour already completed (e.g. on another
  // device, or before this browser's localStorage existed) doesn't fire again
  // once the session/JWT reflects it here.
  useEffect(() => {
    if (!userId) return;
    if (serverCompletedAt && !isTourCompleted(userId)) {
      markTourCompleted(userId);
    }
  }, [userId, serverCompletedAt]);

  useEffect(() => {
    if (pendingSkip) {
      document.body.classList.add("hauto-tour-dialog-open");
    }
    return () => {
      document.body.classList.remove("hauto-tour-dialog-open");
    };
  }, [pendingSkip]);

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
        currentDriverRef.current = null;
      };

      const onCloseClick = (isLastStep: boolean) => {
        if (isLastStep) {
          // User completed the tour naturally — no skip dialog, just mark done
          if (currentDriverRef.current) {
            currentDriverRef.current.destroy(); // triggers onDestroyed → onComplete
            currentDriverRef.current = null;
          }
          return;
        }

        // Mid-tour close → destroy driver.js immediately (no DOM elements left
        // to fight with the dialog) and save state to resume later.
        if (currentDriverRef.current) {
          const activeIndex = currentDriverRef.current.getActiveIndex() ?? 0;
          savedTourState.current = { steps, index: activeIndex };
          currentDriverRef.current.destroy();
          currentDriverRef.current = null;
        }

        setPendingSkip(true);
      };

      const tourDriver = createTourDriver(
        steps,
        () => void onComplete(),
        onCloseClick
      );
      currentDriverRef.current = tourDriver;
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

  const handleSkipConfirm = () => {
    setPendingSkip(false);
    savedTourState.current = null;
    // No need to destroy — was already destroyed in onCloseClick
    // Just mark completed
    if (userId) {
      markTourCompleted(userId);
      void markTourCompletedAction();
      setIsCompleted(true);
    }
  };

  const handleSkipCancel = () => {
    setPendingSkip(false);

    // Recreate driver.js from saved state and resume from same step
    if (savedTourState.current) {
      const { steps: savedSteps, index } = savedTourState.current;
      savedTourState.current = null;

      // Recreate driver
      const onComplete = async () => {
        if (userId) {
          markTourCompleted(userId);
          await markTourCompletedAction();
          setIsCompleted(true);
        }
        currentDriverRef.current = null;
      };

      const onCloseClick = (isLastStep: boolean) => {
        if (isLastStep) {
          if (currentDriverRef.current) {
            currentDriverRef.current.destroy();
            currentDriverRef.current = null;
          }
          return;
        }
        if (currentDriverRef.current) {
          const activeIndex = currentDriverRef.current.getActiveIndex() ?? 0;
          savedTourState.current = { steps: savedSteps, index: activeIndex };
          currentDriverRef.current.destroy();
          currentDriverRef.current = null;
        }
        setPendingSkip(true);
      };

      const tourDriver = createTourDriver(
        savedSteps,
        () => void onComplete(),
        onCloseClick
      );
      currentDriverRef.current = tourDriver;
      tourDriver.drive(index); // resume from saved step
    }
  };

  return (
    <TourContext.Provider
      value={{
        startTour,
        resetAndRestart,
        isCompleted: isCompleted || localCompleted || !!serverCompletedAt,
      }}
    >
      {children}
      <SkipConfirmationDialog
        open={pendingSkip}
        onConfirm={handleSkipConfirm}
        onCancel={handleSkipCancel}
      />
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
