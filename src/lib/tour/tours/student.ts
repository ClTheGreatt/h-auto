import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { DriverHook } from "driver.js";
import type { TourStep } from "../types";
import { waitForSelector } from "../navigation";

// Navigates to `path`, then waits for `targetSelector` to appear on the new
// page before advancing the tour. Falls back to advancing anyway if the
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
        title: "Welcome to H-Auto 🌱",
        description:
          "This is the Smart Gardening Monitoring System for Vegetables. I will show you the main features including your dashboard, plot monitoring, alerts, and analytics. This tour takes about 2 minutes. You can skip anytime and restart from the Help page. Click Next to begin.",
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
          "This is your main navigation. Pages are grouped by purpose. MANAGE contains Plots and Assignments for day to day work. OPERATIONS includes Monitoring and Alerts for live activity. INSIGHTS provides Analytics and Reports for trends and reporting. Help and About are at the bottom.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.stat-my-plots"]',
      popover: {
        title: "My Plots",
        description:
          "This tile shows the number of plots assigned to you for monitoring. It updates in real time when new assignments are added or completed. Click the tile to view the full list of your plots.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.stat-alerts"]',
      popover: {
        title: "Open Alerts",
        description:
          "This tile shows open alerts for your plots. Critical issues such as low soil moisture, high temperature, or low light appear here. A red number indicates critical alerts that need immediate action. Yellow or orange indicates warnings. Zero means all conditions are within optimal range.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.my-plots-grid"]',
      popover: {
        title: "Your assigned plots",
        description:
          "These cards show your assigned plots with the latest sensor readings including moisture, temperature, humidity, and NPK levels. Click any card to view details, log an observation with a photo, or check sensor history.",
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
          "This page shows the same list of your plots in more detail. Use the search box to find plots by name, location, or crop. You can filter by Crop such as Eggplant or Tomato, or by Status such as Preparing, Active, or Harvested. Click any plot row to open its full detail page.",
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
          "This page displays your plot assignments including the faculty member overseeing each plot. It is a read only view. When new plots are assigned to you by a faculty member, they will appear here automatically.",
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
          "This is the activity feed for all growth logs recorded on your plots. Each entry includes photos, plant height, leaf count, sensor readings, and observations. You can filter by date, plot, or author. This is useful for tracking progress over time and reviewing past observations.",
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
          "This page lists all alerts related to your plots. Use the tabs to switch between Open and Resolved alerts. You can filter by severity such as info, warning, or critical, by alert type, or by specific plot. Each alert includes a Suggested action section with step by step guidance.",
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
          "This page shows trends over time. Select a time range such as 24 hours, 7 days, 30 days, all time, or a specific month. Below the range picker you will find charts for sensor trends including soil moisture, temperature, humidity, light intensity, NPK levels, and daily observation counts.",
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
          "This page lets you export data as PDF or Excel files. Available report types include Sensor Readings, Plot Performance, Growth Logs, and Alerts. Select a report type and plot filter, then click download. This is useful for progress reports, official documentation, or personal record-keeping.",
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
        title: "Profile and Settings",
        description:
          "This page is where you edit your account information such as name and phone number, change your password, and select an app theme. The Details section shows your role, ID number, department, and other account information on record.",
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
          "H-Auto includes a mobile companion app. It is designed for field use, allowing you to log observations next to the plot with automatic GPS capture and direct camera photo taking. It uses the same account credentials. Click this link to see download instructions.",
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
        title: "Tour complete 🌿",
        description:
          "Thank you for taking the tour. If you want to review any section again, click the Start tour button on this Help page anytime. This page also contains detailed guides and frequently asked questions for deeper reference. Enjoy using H-Auto.",
        side: "bottom",
        align: "end",
        showButtons: ["previous", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
      },
    },
  ];
}
