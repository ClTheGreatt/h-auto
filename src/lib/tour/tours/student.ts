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
          "Ito ang Smart Gardening Monitoring System para sa Vegetables. Ipapakita ko sa'yo yung mga main features — dashboard, plots monitoring, alerts, at analytics. Around 2 minutes lang, at pwede mo naman i-skip anytime. Pumindot ng 'Next' para magsimula.",
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
          "Dito lahat ng pages ng system, naka-group by purpose. MANAGE (Plots, Assignments) para sa day-to-day work. OPERATIONS (Monitoring, Alerts) para sa live activity. INSIGHTS (Analytics, Reports) para sa trends at reports. Nasa baba yung Help at About.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.stat-my-plots"]',
      popover: {
        title: "My Plots",
        description:
          "Bilang ng plots na assigned sa'yo for monitoring. Real-time counter — mag-a-update automatically kapag may bagong assignment or na-complete. Pwede mo i-click yung buong card para dumiretso sa listahan mo.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.stat-alerts"]',
      popover: {
        title: "Open Alerts",
        description:
          "Kung may issue sa'yong plots (mababang soil moisture, mataas na temperature, low light, atbp.), makikita mo dito. Yung red number = critical alerts na kailangan agad ng aksyon. Yellow / orange = warning. Zero = all clear.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.my-plots-grid"]',
      popover: {
        title: "Yung mga plots mo",
        description:
          "Cards ng plots na assigned sa'yo, kasama yung latest sensor readings (moisture, temp, humidity, NPK). Tap any card para makita yung details, mag-log ng observation with photo, or i-view yung sensor history.",
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
        title: "Plots page",
        description:
          "Same list ng plots mo, mas detalyado. May search box para hanapin by name, location, or crop. May Crop filter (Eggplant, Tomato, atbp.) at Status filter (Preparing, Active, Harvested). Click any plot row para mapunta sa full detail.",
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
          "Dito makikita mo yung mga plots na assigned sa'yo, kasama yung faculty na nag-o-oversee sa bawat isa. Read-only view para sa'yo — pag may bagong plot na na-assign ng faculty, mag-a-appear siya dito. Yung actual assign / unassign action ay ginagawa ng faculty sa plot detail page.",
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
        title: "Monitoring",
        description:
          "Feed ng lahat ng growth logs na na-record sa mga plots mo — photos, plant height, leaf count, sensor snapshot, at observations. May filter by date, plot, at author. Useful para ma-track yung progress over time at makita yung past observations mo.",
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
          "Lahat ng alerts na linked sa plots mo. May Open at Resolved tabs. Filter by severity (info / warning / critical), by type (moisture, temperature, humidity, etc.), or by specific plot. Bawat alert ay may 'Suggested action' section — step-by-step guide kung ano gagawin.",
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
          "Trends over time. Pili ka ng time range — 24 hours, 7 days, 30 days, all-time, or specific month. Sa baba makikita mo yung charts: sensor trends (soil moisture, temperature, humidity), light intensity, NPK levels, at observations count per day.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/reports",
          '[data-tour="reports.grid"]'
        ),
      },
    },
    {
      element: '[data-tour="reports.grid"]',
      popover: {
        title: "Reports",
        description:
          "I-export mo yung data as PDF or Excel — Sensor Readings, Plot Performance, Growth Logs, at Alerts. Pili ka lang ng report type at plot filter, tapos i-download. Handy para sa progress reports, defense documentation, or personal backup ng iyong data.",
        side: "top",
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
          "Dito mo ini-edit yung account info mo (pangalan, phone number), pinapalitan yung password, at pinipili yung app theme (light / dark / auto). May Details section din — nakita mo dito yung role, ID number, department, at iba pang info na naka-record sa account mo.",
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
          "Salamat sa pagsama sa tour. Kung gusto mong ulit-ulitin ito anytime, pumindot lang ng 'Start tour' button dito sa Help page. May mga detailed guides at FAQ din sa page na ito para sa mas malalim na tanong. Enjoy H-Auto!",
        side: "bottom",
        align: "end",
        showButtons: ["previous", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
      },
    },
  ];
}
