import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { UserRole } from "@prisma/client";
import type { TourStep } from "./types";
import { createStudentTour } from "./tours/student";
import { createFacultyTour } from "./tours/faculty";
import { createAdminTour } from "./tours/admin";

/**
 * Returns the tour script for the given role, or null if no tour is defined.
 */
export function getTourForRole(
  role: UserRole,
  router: AppRouterInstance
): TourStep[] | null {
  switch (role) {
    case "STUDENT_FARMER":
      return createStudentTour(router);
    case "FACULTY":
      return createFacultyTour(router);
    case "ADMIN":
    case "SUPER_ADMIN":
      return createAdminTour(router);
    default:
      return null;
  }
}

export function hasTourForRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  return ["STUDENT_FARMER", "FACULTY", "ADMIN", "SUPER_ADMIN"].includes(role);
}
