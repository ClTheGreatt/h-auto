import type { DriveStep } from "driver.js";

export type TourRole = "STUDENT_FARMER" | "FACULTY" | "ADMIN" | "SUPER_ADMIN";

export type TourStep = DriveStep & {
  // Which route this step lives on, for cross-page tours in a later prompt.
  route?: string;
};

export type TourScript = TourStep[];
