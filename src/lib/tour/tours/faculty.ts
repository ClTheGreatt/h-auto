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

export function createFacultyTour(router: AppRouterInstance): TourStep[] {
  return [
    {
      popover: {
        title: "Welcome sa H-Auto, Faculty! 🌱",
        description:
          "Bilang Faculty, ikaw yung nag-o-oversee ng mga Student Farmers at mga plots nila. Ipapakita ko sa'yo yung mga tools mo — pag-manage ng assignments, pag-monitor ng plots, pag-respond sa alerts, at pag-generate ng reports. Around 2-3 minutes lang. Pwede mo naman i-skip anytime.",
        showButtons: ["next", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard",
          '[data-tour="sidebar.container"]'
        ),
      },
    },
    {
      element: '[data-tour="sidebar.container"]',
      popover: {
        title: "Navigation sidebar",
        description:
          "MANAGE section — Plots (lahat ng plots na oversee mo), Assignments (i-assign yung mga students). OPERATIONS — Monitoring (growth logs feed) at Alerts (may Resolve action ka rito). INSIGHTS — Analytics at Reports (may Student Activity report exclusive sa Faculty at Admin).",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.stat-my-plots"]',
      popover: {
        title: "Plots I Oversee",
        description:
          "Bilang ng plots na naka-assign sa'yo bilang faculty adviser. As Faculty, nakikita mo lahat ng plots na oversee mo — hindi lang yung isa. Click mo para makita yung full list.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.stat-alerts"]',
      popover: {
        title: "Open Alerts",
        description:
          "Lahat ng alerts sa mga plots na oversee mo. Bilang Faculty, may capability ka na i-resolve mismo yung alert after mo mag-respond — feature na wala sa Student view.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.my-plots-grid"]',
      popover: {
        title: "Yung mga plots mo",
        description:
          "Cards ng plots na oversee mo, kasama yung latest sensor readings. Tap any card para makita yung details at para i-manage yung mga students na naka-assign dito.",
        side: "top",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/plots",
          '[data-tour="plots.filter-bar"]'
        ),
      },
    },
    {
      element: '[data-tour="plots.filter-bar"]',
      popover: {
        title: "Plots I Oversee",
        description:
          "Mas detalyadong view ng lahat ng plots mo. May search at filters (crop, status). Click any plot row para pumunta sa Plot Detail page — dun mo makikita ang 'Monitoring Assignments' card, kung saan mo ma-a-assign or ma-uunassign yung mga students per plot. Ito yung pangunahing tool mo bilang faculty adviser.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/assignments",
          '[data-tour="assignments.list"]'
        ),
      },
    },
    {
      element: '[data-tour="assignments.list"]',
      popover: {
        title: "Assignments",
        description:
          "Overview ng lahat ng student assignments na ginawa mo. Read-only list — kung gusto mong mag-assign ng bagong student sa isang plot, dumaan ka sa Plot Detail page (may Assign Student card doon).",
        side: "top",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/monitoring",
          '[data-tour="monitoring.feed"]'
        ),
      },
    },
    {
      element: '[data-tour="monitoring.feed"]',
      popover: {
        title: "Monitoring feed",
        description:
          "Feed ng lahat ng growth logs na na-record ng mga students mo — photos, plant height, leaf count, sensor snapshot per log. Useful para ma-review kung consistent yung pag-log at para makita yung mga observations.",
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
        title: "Alerts",
        description:
          "Lahat ng alerts sa plots mo. May 'Resolve' button ka per alert row — after mo mag-respond sa issue (nag-diligan, nag-add ng shade, atbp.), tap Resolve para ma-close yung alert. May 'Suggested action' guidance din per alert.",
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
          "System-wide trends across lahat ng plots mo. Pili ka ng time range at plot filter, tapos makikita mo yung charts — sensor trends, alerts over time, observations bar chart (click bars para ma-drill-down).",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/reports",
          '[data-tour="reports.student-activity"]'
        ),
      },
    },
    {
      element: '[data-tour="reports.student-activity"]',
      popover: {
        title: "Student Activity Report",
        description:
          "Faculty-exclusive report — nakikita mo dito kung sino sa mga students mo yung consistent mag-log at kung sino yung less active. Export as PDF or Excel. Handy para sa evaluations at feedback.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/profile",
          '[data-tour="profile.settings-card"]'
        ),
      },
    },
    {
      element: '[data-tour="profile.settings-card"]',
      popover: {
        title: "Profile & Settings",
        description:
          "Manage yung account info mo, palitan ang password, at pumili ng theme. May Details section din — makikita mo ang role, employee ID, department, at position mo.",
        side: "left",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/download",
          '[data-tour="sidebar.download-app"]'
        ),
      },
    },
    {
      element: '[data-tour="sidebar.download-app"]',
      popover: {
        title: "Mobile app",
        description:
          "May mobile companion app din pala ang H-Auto. Sa field talaga mo ito gagamitin — mag-log ng observation habang katabi mo yung plot, may auto-captured GPS at direktang camera capture. Same account mo lang gamit. I-click ito para makita yung download instructions.",
        side: "right",
        align: "start",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/help",
          '[data-tour="help.restart-tour-button"]'
        ),
      },
    },
    {
      element: '[data-tour="help.restart-tour-button"]',
      popover: {
        title: "Tapos na! 🌿",
        description:
          "Salamat sa pagsama sa tour. Kung gusto mong ulit-ulitin, pumindot lang ng 'Start tour' button dito sa Help page. May mga detailed guides at FAQ din dito para sa mas malalim na tanong. Enjoy pag-oversee ng mga plots! 🌱",
        side: "bottom",
        align: "end",
        showButtons: ["previous", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
      },
    },
  ];
}
