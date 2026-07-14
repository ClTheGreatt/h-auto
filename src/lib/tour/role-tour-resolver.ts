import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { UserRole } from "@prisma/client";
import type { TourStep } from "./types";
import { createStudentTour } from "./tours/student";

/**
 * Returns the tour script for the given role, or null if no tour is defined.
 * As more roles get tours (Faculty, Admin), extend this switch.
 */
export function getTourForRole(
  role: UserRole,
  router: AppRouterInstance
): TourStep[] | null {
  switch (role) {
    case "STUDENT_FARMER":
      return createStudentTour(router);
    case "FACULTY":
    case "ADMIN":
    case "SUPER_ADMIN":
      return null; // TODO: added in next round
    default:
      return null;
  }
}

export function hasTourForRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === "STUDENT_FARMER";
  // TODO: add FACULTY / ADMIN / SUPER_ADMIN in next round
}
