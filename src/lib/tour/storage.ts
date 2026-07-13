export const TOUR_KEY_PREFIX = "hauto:tour:v1";

export function getStorageKey(userId: string): string {
  return `${TOUR_KEY_PREFIX}:${userId}:completed`;
}

export function isTourCompleted(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(getStorageKey(userId)) === "true";
}

export function markTourCompleted(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(userId), "true");
}

export function resetTour(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getStorageKey(userId));
}
