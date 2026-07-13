import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { TourStep } from "./types";

export function createTourDriver(steps: TourStep[], onComplete: () => void) {
  return driver({
    steps,
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    allowClose: true,
    smoothScroll: true,
    overlayOpacity: 0.6,
    popoverClass: "hauto-tour-popover",
    onDestroyed: () => onComplete(),
  });
}
