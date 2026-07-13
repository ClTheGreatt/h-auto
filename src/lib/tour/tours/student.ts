import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { DriverHook } from "driver.js";
import type { TourStep } from "../types";
import { waitForSelector } from "../navigation";

// Navigates to `path`, then waits for `targetSelector` to appear on the new
// page before advancing the tour — falls back to advancing anyway if the
// element never shows up (e.g. slow render), so the tour never gets stuck.
function navigateAndAdvance(
  router: AppRouterInstance,
  path: string,
  targetSelector: string
): DriverHook {
  return (_element, _step, opts) => {
    router.push(path);
    waitForSelector(targetSelector)
      .then(() => opts.driver.moveNext())
      .catch(() => opts.driver.moveNext());
  };
}

export function createStudentTour(router: AppRouterInstance): TourStep[] {
  return [
    {
      popover: {
        title: "Welcome sa H-Auto! 🌱",
        description:
          "Ipapakita ko sa'yo yung buong system — mga 2 minutes lang. Pwede mo i-skip anytime, and pwede mong ulit-ulitin sa Help page.",
        showButtons: ["next", "close"],
      },
    },
    {
      element: '[data-tour="sidebar.container"]',
      popover: {
        title: "Yung sidebar mo",
        description:
          "Dito lahat ng pages na pwede mo puntahan — Dashboard, Plots, Alerts, and iba pa.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.stat-my-plots"]',
      popover: {
        title: "My Plots",
        description:
          "Bilang ng plots na assigned sa'yo. Click mo yung tile para makita lahat.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.stat-alerts"]',
      popover: {
        title: "Open Alerts",
        description:
          "Kung may plots na may issue (mababang moisture, mataas temperature, etc.), makikita mo dito. Yung red number = critical alerts.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.my-plots-grid"]',
      popover: {
        title: "Yung mga plots mo",
        description:
          "Grid ng plots na na-assign sa'yo. Click para makita yung latest sensor readings at para mag-log ng observation.",
        side: "top",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/plots",
          '[data-tour="plots.list-container"]'
        ),
      },
    },
    {
      element: '[data-tour="plots.list-container"]',
      popover: {
        title: "Plots page",
        description:
          "Same list, mas detalyado. May search + status filter. Click any plot to see latest readings and log an observation.",
        side: "top",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/alerts",
          '[data-tour="alerts.filters"]'
        ),
      },
    },
    {
      element: '[data-tour="alerts.filters"]',
      popover: {
        title: "Alerts page",
        description:
          "Lahat ng alerts na related sa plots mo. Filter by severity, type, or plot. May 'Suggested action' guidance sa bawat alert.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/analytics",
          '[data-tour="analytics.range-picker"]'
        ),
      },
    },
    {
      element: '[data-tour="analytics.range-picker"]',
      popover: {
        title: "Analytics",
        description:
          "Trends over time — soil moisture, temperature, NPK levels, observations. Pili ka ng time range at makikita mo yung charts.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/profile",
          '[data-tour="profile.help-link"]'
        ),
      },
    },
    {
      element: '[data-tour="profile.help-link"]',
      popover: {
        title: "Help & Documentation",
        description:
          "May mga detalyadong guides at FAQs dito. Pwede mo rin i-restart ang tour anytime galing sa Help page.",
        side: "top",
      },
    },
    {
      popover: {
        title: "Tapos na! 🌿",
        description:
          "Salamat sa pagsama sa tour. Enjoy H-Auto! Kung may tanong, pumunta lang sa Help page.",
        showButtons: ["previous", "close"],
      },
    },
  ];
}
