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

export function createFacultyTour(router: AppRouterInstance): TourStep[] {
  return [
    {
      popover: {
        title: "Welcome to H-Auto, Faculty 🌱",
        description:
          "As a faculty member, you oversee student farmers and their assigned plots. Let me show you your available tools including assignment management, plot monitoring, alert response, and reporting functions. This tour takes about 2 to 3 minutes. You can skip anytime and restart from the Help page.",
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
          "In the MANAGE section, Plots shows all plots under your supervision and Assignments lets you manage student assignments. In OPERATIONS, Monitoring shows the growth logs feed and Alerts allows you to resolve issues. In INSIGHTS, Analytics and Reports include a Student Activity report available exclusively to Faculty and Admin roles.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.attention-summary"]',
      popover: {
        title: "Today's triage",
        description:
          "H-Auto evaluates every plot you advise and surfaces what needs attention first, such as a critical alert, an offline device, or missing setup. Checking this is the first thing to do each day, before anything else on the dashboard.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.plot-cards"]',
      popover: {
        title: "Plot cards",
        description:
          "Every plot you oversee gets its own card here, showing its latest sensor readings, device status, and any open alerts at a glance. Click a card to view its details and manage the students assigned to it.",
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
          "This page provides a detailed view of all your plots. Click any plot row to open its Plot Detail page. There you will find the Monitoring Assignments card where you can assign or unassign students per plot. This is your primary tool as a faculty adviser.",
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
          "This page provides an overview of all student assignments you have created. It is a read only list. To assign a new student to a plot, navigate to the Plot Detail page and use the Assign Student card there.",
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
          "This is the activity feed of all growth logs recorded by your students. Each entry includes photos, plant height, leaf count, and sensor snapshots. This is useful for reviewing log consistency and observations made in the field.",
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
          "This page lists all alerts on your assigned plots. Each row includes a Resolve button. After you address an issue such as watering, adding shade, or adjusting conditions, click Resolve to close the alert. Each alert also includes Suggested action guidance.",
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
          "This page shows system wide trends across all your plots. Select a time range and plot filter to view charts including sensor trends, alerts over time, and observation counts. The Observations bar chart supports drill down for detailed inspection.",
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
          "This is a Faculty exclusive report. It shows which of your students are consistently logging observations and which are less active. Export the report as PDF or Excel. This is useful for student evaluations and providing feedback.",
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
        title: "Profile and Settings",
        description:
          "This page is where you edit your account information, change your password, and select an app theme. The Details section shows your role, employee ID, department, and position.",
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
          "H-Auto includes a mobile companion app. It is designed for field use, allowing you to log observations, review student activity, and respond to alerts on the go. It uses the same account credentials. Click this link to see download instructions.",
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
          "Thank you for taking the tour. If you want to review any section again, click the Start tour button on this Help page anytime. This page also contains detailed guides and frequently asked questions for deeper reference. Enjoy overseeing your plots.",
        side: "bottom",
        align: "end",
        showButtons: ["previous", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
      },
    },
  ];
}
