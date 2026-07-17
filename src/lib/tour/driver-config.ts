import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { TourStep } from "./types";

export function createTourDriver(
  steps: TourStep[],
  onComplete: () => void,
  onCloseClick?: (isLastStep: boolean) => void
) {
  return driver({
    steps,
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    allowClose: true,
    overlayClickBehavior: "close", // EXPLICIT: overlay click triggers close flow
    smoothScroll: true,
    overlayOpacity: 0.6,
    popoverClass: "hauto-tour-popover",
    onDestroyed: () => {
      console.log("[tour] onDestroyed fired");
      onComplete();
    },
    onCloseClick: onCloseClick
      ? (_element, _step, opts) => {
          const activeIndex = opts.state.activeIndex ?? 0;
          const totalSteps = steps.length;
          const isLastStep = activeIndex === totalSteps - 1;
          console.log("[tour] onCloseClick fired, activeIndex:", activeIndex, "isLast:", isLastStep);
          onCloseClick(isLastStep);
        }
      : undefined,
  });
}
