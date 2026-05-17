"use client";

import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "FACULTY" | "STUDENT_FARMER";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[] | "all";
};

const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: "all" },
  { href: "/dashboard/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/dashboard/crops", label: "Crops", icon: Sprout, roles: ["SUPER_ADMIN", "ADMIN", "FACULTY"] },
  { href: "/dashboard/plots", label: "Plots", icon: MapPinned, roles: "all" },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList, roles: "all" },
  { href: "/dashboard/devices", label: "Devices", icon: Cpu, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Camera, roles: "all" },
  { href: "/dashboard/alerts", label: "Alerts", icon: BellRing, roles: "all" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: "all" },
  { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: "all" },
];

const secondaryNavItems: NavItem[] = [
  { href: "/dashboard/help", label: "Help", icon: HelpCircle, roles: "all" },
  { href: "/dashboard/about", label: "About", icon: Info, roles: "all" },
];

export function Sidebar({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const visibleMain = mainNavItems.filter(
    (item) => item.roles === "all" || item.roles.includes(role)
  );
  const visibleSecondary = secondaryNavItems.filter(
    (item) => item.roles === "all" || item.roles.includes(role)
  );

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
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
          isActive
            ? "bg-green-50 text-green-700 font-medium shadow-sm"
            : "text-gray-700 hover:bg-gray-50 hover:translate-x-0.5"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-6 border-b border-gray-200">
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

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto flex flex-col">
        {/* Main navigation */}
        <div className="space-y-1">
          {visibleMain.map(renderItem)}
        </div>

        {/* Spacer pushes secondary nav to bottom */}
        <div className="flex-1" />

        {/* Secondary navigation - Help + About */}
        <div className="pt-3 border-t border-gray-200 space-y-1">
          {visibleSecondary.map(renderItem)}
        </div>
      </nav>

      <div className="p-3 border-t border-gray-200 text-xs text-gray-400 text-center">
        H-Auto v1.0
      </div>
    </aside>
  );
}