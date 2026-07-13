"use client";

import Link from "next/link";
import { AlertsBadge } from "./alerts-badge";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Sprout,
  MapPinned,
  ClipboardList,
  Cpu,
  Camera,
  BellRing,
  BarChart3,
  FileText,
  HelpCircle,
  Info,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "FACULTY" | "STUDENT_FARMER";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[] | "all";
};

type NavGroup = {
  label: string | null; // null = no section header (e.g., solo Dashboard)
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: "all" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/dashboard/crops", label: "Crops", icon: Sprout, roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/dashboard/plots", label: "Plots", icon: MapPinned, roles: "all" },
      { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList, roles: "all" },
      { href: "/dashboard/devices", label: "Devices", icon: Cpu, roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/monitoring", label: "Monitoring", icon: Camera, roles: "all" },
      { href: "/dashboard/alerts", label: "Alerts", icon: BellRing, roles: "all" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: "all" },
      { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: "all" },
    ],
  },
];

const secondaryNavItems: NavItem[] = [
  { href: "/dashboard/download", label: "Download App", icon: Smartphone, roles: "all" },
  { href: "/dashboard/help", label: "Help", icon: HelpCircle, roles: "all" },
  { href: "/dashboard/about", label: "About", icon: Info, roles: "all" },
];

function filterByRole<T extends { roles: UserRole[] | "all" }>(
  items: T[],
  role: UserRole
): T[] {
  return items.filter(
    (item) => item.roles === "all" || item.roles.includes(role)
  );
}

export function Sidebar({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  // Filter each group's items by role, then drop empty groups
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: filterByRole(group.items, role) }))
    .filter((group) => group.items.length > 0);

  const visibleSecondary = filterByRole(secondaryNavItems, role);

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const isActive =
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        data-tour={item.href === "/dashboard/help" ? "profile.help-link" : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
          isActive
            ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-medium shadow-sm"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:translate-x-0.5"
        )}
      >
  <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.href === "/dashboard/alerts" && <AlertsBadge />}
      </Link>
    );
  }

  return (
    <aside
      data-tour="sidebar.container"
      className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full"
    >
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900">H-Auto</div>
            <div className="text-xs text-gray-500">Smart Gardening</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto flex flex-col">
        {/* Grouped main navigation */}
        <div>
          {visibleGroups.map((group, idx) => (
            <div key={group.label ?? `group-${idx}`}>
              {group.label && (
                <div
                  className={cn(
                    "px-3 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider",
                    idx > 0 ? "pt-4" : "pt-0"
                  )}
                >
                  {group.label}
                </div>
              )}
              <div className="space-y-1">{group.items.map(renderItem)}</div>
            </div>
          ))}
        </div>

        {/* Spacer pushes secondary nav to bottom */}
        <div className="flex-1" />

        {/* Secondary navigation */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
          {visibleSecondary.map(renderItem)}
        </div>
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 text-center">
        H-Auto 
      </div>
    </aside>
  );
}