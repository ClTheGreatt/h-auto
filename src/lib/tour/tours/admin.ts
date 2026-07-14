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

export function createAdminTour(router: AppRouterInstance): TourStep[] {
  return [
    {
      popover: {
        title: "Welcome sa H-Auto, Admin! 🌱",
        description:
          "Bilang Admin, may full system access ka — user management, device registration, crop configuration, at lahat ng features ng system. Ipapakita ko sa'yo yung mga admin-exclusive tools. Around 3-4 minutes lang. Pwede mo naman i-skip anytime.",
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
          "Admin at Super Admin ka, so nakikita mo lahat ng nav items: MANAGE (Users, Crops, Plots, Devices, Assignments), OPERATIONS (Monitoring, Alerts), INSIGHTS (Analytics, Reports). Users at Devices ay admin-exclusive, so hindi mo makikita yang ilang items pag Faculty or Student ka.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.stat-my-plots"]',
      popover: {
        title: "Total Plots",
        description:
          "Buong system plot count. As Admin, nakikita mo lahat ng plots regardless of assignment. Click para makita yung full list.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.stat-alerts"]',
      popover: {
        title: "Open Alerts",
        description:
          "System-wide alerts count. Ikaw ang may pinakamataas na view — nakikita mo alerts para sa lahat ng plots at users.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.my-plots-grid"]',
      popover: {
        title: "System Activity Overview",
        description:
          "Overview ng recent activity across the system. Ito yung dashboard ng buong operation mo — lahat ng plots, lahat ng students, real-time.",
        side: "top",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/users",
          '[data-tour="users.list"]'
        ),
      },
    },
    {
      element: '[data-tour="users.list"]',
      popover: {
        title: "User Management",
        description:
          "Lahat ng users sa system, grouped by role. Click a row para makita ang detail (role, activity, ID). Yung 'Add user' button pang-manual add ng isa-isa, may 'Import' button din para sa CSV/Excel bulk-create ng maraming users at once.",
        side: "top",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/crops",
          '[data-tour="crops.list"]'
        ),
      },
    },
    {
      element: '[data-tour="crops.list"]',
      popover: {
        title: "Crop Configuration",
        description:
          "Lahat ng crops na naka-configure sa system — with default growth stages, days-to-harvest, at threshold ranges. Admin-exclusive management. Yung threshold ranges dito ay ginagamit ng system para ma-trigger yung alerts.",
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
        title: "All Plots",
        description:
          "Lahat ng plots sa system. May 'Add plot' button ka (Admin+ only), at pwede mo i-edit or delete ang existing plots via yung per-row '⋯' menu. Click any plot to open its details.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/devices",
          '[data-tour="devices.list"]'
        ),
      },
    },
    {
      element: '[data-tour="devices.list"]',
      popover: {
        title: "Device Management",
        description:
          "Registered ESP32 devices na nag-a-ingest ng sensor data. May 'Register device' button para magdagdag ng bago (nag-ge-generate ng API key na ico-configure mo sa firmware). Per-row '⋯' menu ay may Simulate Reading (test data injection), Regenerate API key (kung na-compromise), at Edit / Delete.",
        side: "top",
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
        title: "All Assignments",
        description:
          "Lahat ng student-plot assignments sa system. As Admin, nakikita mo lahat, hindi lang yung ginawa mo. Yung actual assign / unassign action ay ginagawa sa Plot Detail page.",
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
          "System-wide growth log feed — lahat ng logs sa lahat ng plots. Nakita mo dito kung sino nag-log, kung kelan, at kung ano yung sensor readings sa moment na yun.",
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
        title: "System Alerts",
        description:
          "Lahat ng alerts, all plots, all severity levels. Pwede mo i-resolve mismo (Faculty+ / Admin capability). May detailed per-recipient SMS delivery status kada alert kung na-expand mo yung row.",
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
        title: "System Analytics",
        description:
          "System-wide trends. As Admin, walang filter na naka-apply — nakikita mo aggregated data across lahat ng plots. Useful for high-level system health monitoring.",
        side: "bottom",
        onNextClick: navigateAndAdvance(
          router,
          "/dashboard/reports",
          '[data-tour="reports.system-activity"]'
        ),
      },
    },
    {
      element: '[data-tour="reports.system-activity"]',
      popover: {
        title: "System Activity Report",
        description:
          "Admin-exclusive report — user actions across the system, logins, changes, deletions. Import compliance / audit trail. Export as PDF or Excel.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="reports.student-activity"]',
      popover: {
        title: "Student Activity Report",
        description:
          "Available din sa Admin — nakikita mo lahat ng students, hindi lang yung sa specific faculty. Kung gusto mong mag-generate ng academic activity report for defense or grading, dito ka pupunta.",
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
          "Manage yung account info mo, palitan ang password, at pumili ng theme. As Admin, nakikita mo rin yung 'Administration' section sa mobile app for Manage Users access on the go.",
        side: "left",
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
          "Salamat sa pagsama sa tour. Kung gusto mong ulit-ulitin, pumindot lang ng 'Start tour' button dito sa Help page. Detailed guides at FAQ din dito. Enjoy administering H-Auto! 🌱",
        side: "bottom",
        align: "end",
        showButtons: ["previous", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
      },
    },
  ];
}
