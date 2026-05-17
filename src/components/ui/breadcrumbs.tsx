"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

// Display labels for known route segments
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  crops: "Crops",
  plots: "Plots",
  assignments: "Assignments",
  devices: "Devices",
  monitoring: "Monitoring",
  alerts: "Alerts",
  analytics: "Analytics",
  reports: "Reports",
  help: "Help",
  about: "About",
  new: "New",
  edit: "Edit",
  import: "Import",
  settings: "Settings",
  profile: "Profile",
};

// Generic detail labels when a trailing segment is a dynamic ID
const DETAIL_LABELS: Record<string, string> = {
  users: "User Profile",
  crops: "Crop Detail",
  plots: "Plot Detail",
  alerts: "Alert Detail",
  devices: "Device Detail",
  assignments: "Assignment Detail",
};

// Detect cuid/uuid-style IDs (long, no spaces)
function isLikelyId(segment: string): boolean {
  if (segment.length < 20) return false;
  if (/\s/.test(segment)) return false;
  return true;
}

function formatLabel(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // Fallback: capitalize first letter (e.g., unknown future routes)
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();

  // Hide on dashboard root (page title is enough there)
  if (pathname === "/dashboard" || pathname === "/") {
    return null;
  }

  const allSegments = pathname.split("/").filter(Boolean);

  type Crumb = { href: string; label: string };
  const crumbs: Crumb[] = [];

  for (let i = 0; i < allSegments.length; i++) {
    const segment = allSegments[i];
    const isLast = i === allSegments.length - 1;
    const href = "/" + allSegments.slice(0, i + 1).join("/");

    if (isLikelyId(segment)) {
      if (isLast) {
        // Trailing ID → show generic detail label (e.g., "Plot Detail")
        const parent = allSegments[i - 1];
        const label = DETAIL_LABELS[parent] ?? "Detail";
        crumbs.push({ href, label });
      }
      // Mid-path ID (e.g., /users/abc123/edit) → skip entirely
      continue;
    }

    crumbs.push({ href, label: formatLabel(segment) });
  }

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center flex-wrap gap-1 text-sm text-gray-500 mb-4"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <Fragment key={crumb.href}>
            {idx > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
            {isLast ? (
              <span aria-current="page" className="text-gray-900 font-medium">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-green-700 hover:underline transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}