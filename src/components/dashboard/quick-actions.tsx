"use client";

import Link from "next/link";
import {
  Camera,
  Activity,
  FileText,
  BellRing,
  Plus,
  Cpu,
  UserPlus,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "FACULTY" | "STUDENT_FARMER";

type ActionItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  primary?: boolean; // productive (create/add) vs navigational
  badge?: { count: number; tone: "red" | "amber" };
};

type Props = {
  role: UserRole;
  openAlertCount: number;
  criticalAlertCount: number;
  studentFirstPlot?: { id: string; name: string } | null;
};

export function QuickActions({
  role,
  openAlertCount,
  criticalAlertCount,
  studentFirstPlot,
}: Props) {
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isFaculty = role === "FACULTY";
  const isStudent = role === "STUDENT_FARMER";

  const actions: ActionItem[] = [];

  // ━━━ PRIMARY (productive) actions ━━━
  if (isStudent && studentFirstPlot) {
    actions.push({
      href: `/dashboard/plots/${studentFirstPlot.id}/log/new`,
      icon: Plus,
      label: "Log observation",
      description: `For ${studentFirstPlot.name}`,
      primary: true,
    });
  }

  if (isFaculty) {
    actions.push({
      href: "/dashboard/assignments",
      icon: ClipboardList,
      label: "Assignments",
      description: "Manage student plots",
      primary: true,
    });
  }

  if (isAdmin) {
    actions.push({
      href: "/dashboard/users/new",
      icon: UserPlus,
      label: "Add user",
      description: "Faculty or student",
      primary: true,
    });
    actions.push({
      href: "/dashboard/devices/new",
      icon: Cpu,
      label: "Register device",
      description: "Add ESP32 sensor",
      primary: true,
    });
  }

  // ━━━ Navigational quick links ━━━
  actions.push({
    href: "/dashboard/monitoring",
    icon: Camera,
    label: "Monitor plots",
    description: "Observation timeline",
  });

  // Alerts — always visible, badge appears only when there are open alerts
  actions.push({
    href: "/dashboard/alerts",
    icon: BellRing,
    label: "Alerts",
    description: openAlertCount > 0 ? `${openAlertCount} open` : "All resolved",
    badge:
      criticalAlertCount > 0
        ? { count: criticalAlertCount, tone: "red" }
        : openAlertCount > 0
        ? { count: openAlertCount, tone: "amber" }
        : undefined,
  });

  actions.push({
    href: "/dashboard/analytics",
    icon: Activity,
    label: "Analytics",
    description: "Charts & trends",
  });

  actions.push({
    href: "/dashboard/reports",
    icon: FileText,
    label: "Reports",
    description: "Export PDF/Excel",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {actions.map((action) => (
            <ActionCard key={action.href} {...action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  href,
  icon: Icon,
  label,
  description,
  primary,
  badge,
}: ActionItem) {
  return (
    <Link
      href={href}
      className={cn(
        "relative group flex items-start gap-3 p-3 rounded-md border transition-all",
        primary
          ? "border-green-200 bg-green-50/50 hover:border-green-300 hover:bg-green-50 hover:shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-md flex-shrink-0 transition-colors",
          primary
            ? "bg-green-100 text-green-700 group-hover:bg-green-200"
            : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 truncate">
          {label}
        </div>
        <div className="text-xs text-gray-500 truncate">{description}</div>
      </div>
      {badge && (
        <Badge
          className={cn(
            "absolute top-2 right-2 text-[10px] h-5 min-w-5 px-1.5 flex items-center justify-center",
            badge.tone === "red"
              ? "bg-red-100 text-red-700 hover:bg-red-100"
              : "bg-amber-100 text-amber-700 hover:bg-amber-100"
          )}
        >
          {badge.count}
        </Badge>
      )}
    </Link>
  );
}