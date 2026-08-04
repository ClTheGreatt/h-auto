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

export function createAdminTour(router: AppRouterInstance): TourStep[] {
  return [
    {
      popover: {
        title: "Welcome to H-Auto, Admin 🌱",
        description:
          "As an administrator, you have full system access including user management, device registration, crop configuration, and all system features. Let me show you the admin exclusive tools. This tour takes about 3 to 4 minutes. You can skip anytime and restart from the Help page.",
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
          "As an Admin or Super Admin, you have access to all navigation items. MANAGE includes Users, Crops, Plots, Devices, and Assignments. OPERATIONS includes Monitoring and Alerts. INSIGHTS includes Analytics and Reports. Users and Devices are admin exclusive, so Faculty and Student users do not see these items.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="dashboard.attention-summary"]',
      popover: {
        title: "Today's triage",
        description:
          "H-Auto evaluates every plot in the system and surfaces what needs attention first, such as a critical alert, an offline device, or missing setup. Checking this is the first thing to do each day, before anything else on the dashboard.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="dashboard.plot-cards"]',
      popover: {
        title: "Plot cards",
        description:
          "Every plot in the system gets its own card here, showing its latest sensor readings, device status, and any open alerts at a glance. As an Admin, this covers every plot regardless of who it's assigned to.",
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
          "This page lists all users in the system, grouped by role. Click any row to view user details including role, activity, and ID information. The Add user button lets you add users individually, while the Import CSV button allows bulk creation from a CSV or Excel file.",
        side: "top",
      },
    },
    {
      element: '[data-tour="users.add-button"]',
      popover: {
        title: "Adding a single user",
        description:
          "Click the Add user button to add users one at a time. Fill in the form with email, name, and role. Depending on the role, specific fields will appear. Course, Year, and Section for Students, or Department and Position for Faculty. A temporary password is generated automatically and emailed to the user, who can change it after signing in.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="users.import-button"]',
      popover: {
        title: "Bulk import users",
        description:
          "For adding multiple users at once such as an entire section or batch, click the Import CSV button. It accepts CSV or Excel files. A downloadable template is provided so you know the exact format required. This is useful at the beginning of a semester when onboarding many students simultaneously.",
        side: "bottom",
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
          "This page lists all crops configured in the system with their default growth stages, days to harvest, and threshold ranges. This is admin exclusive management. The threshold ranges configured here drive automatic alerts when sensor readings fall outside optimal conditions.",
        side: "top",
      },
    },
    {
      element: '[data-tour="crops.add-button"]',
      popover: {
        title: "Adding a crop",
        description:
          "Click this button to add a new crop with its own growth stages, days to harvest, and ideal sensor threshold ranges covering moisture, temperature, humidity, and NPK levels. A preset library of 9 Philippine vegetables is available, so you do not need to enter every threshold manually.",
        side: "bottom",
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
          "This page shows all plots in the system. As an Admin or Super Admin, you can create new plots using the Add plot button. You can also edit or delete existing plots through the per row actions menu. Click any plot to view its details.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="plots.add-button"]',
      popover: {
        title: "Creating a plot",
        description:
          "Click this button to add a new plot. Fill in the plot name, location, the crop to be planted, and the expected planting date. Once created, you will be taken to the Plot Detail page where you can assign students to the plot.",
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
          "This page lists all registered ESP32 devices that ingest sensor data. Click the Register device button to add a new device, which generates an API key to be configured in the firmware. The per row actions menu includes Simulate Reading for test data injection, Regenerate API key in case a key is compromised, and Edit or Delete options.",
        side: "top",
      },
    },
    {
      element: '[data-tour="devices.register-button"]',
      popover: {
        title: "Registering an ESP32 device",
        description:
          "Click the Register device button when installing a new physical sensor unit. The system generates a one time API key that you will configure in the ESP32 firmware. Important: the API key will not be shown again after you close the dialog, so copy and save it immediately.",
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
        title: "All Assignments",
        description:
          "This page shows all student to plot assignments in the system. As an Admin, you see all assignments, not just those you created. The actual assign and unassign actions are performed on the Plot Detail page.",
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
          "This is the system wide growth log feed showing all logs from all plots. Each entry displays who logged the observation, when, and the sensor readings at that moment.",
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
          "This page shows all alerts across all plots and severity levels. You can resolve alerts directly, a capability available to Faculty and Admin roles. Expand any row to view detailed per recipient SMS delivery status for each alert.",
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
          "This page shows system wide trends. As an Admin, no filter is applied by default, so you see aggregated data across all plots. This is useful for high level system health monitoring.",
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
          "This is an Admin exclusive report showing user actions across the system including logins, changes, and deletions. It provides an audit trail useful for compliance and internal review. Export the report as PDF or Excel.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="reports.student-activity"]',
      popover: {
        title: "Student Activity Report",
        description:
          "This report is also available to Admins. Unlike Faculty who see only their students, you see all students in the system. This is useful for generating academic activity reports for reviews or grading.",
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
          "This page is where you edit your account information, change your password, and select an app theme. As an Admin, you can also access the Administration section in the mobile app for user management while on the go.",
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
          "H-Auto includes a mobile companion app. It is designed for field use with the same admin capabilities including user management, monitoring, and alert response. It uses the same account credentials. Click this link to see download instructions.",
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
          "Thank you for taking the tour. If you want to review any section again, click the Start tour button on this Help page anytime. This page also contains detailed guides and frequently asked questions for deeper reference. Enjoy administering H-Auto.",
        side: "bottom",
        align: "end",
        showButtons: ["previous", "close"],
        popoverClass: "hauto-tour-popover hauto-tour-popover-modal",
      },
    },
  ];
}
