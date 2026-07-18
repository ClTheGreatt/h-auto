import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import {
  Sprout,
  MapPinned,
  Camera,
  BellRing,
  Activity,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { timeAgo } from "@/lib/format-date";
import { QuickActions } from "@/components/dashboard/quick-actions";

const OBSERVATION_TRUNCATE_LENGTH = 100;

const STAGE_BADGE_COLORS: Record<string, string> = {
  Germination: "bg-lime-100 text-lime-700",
  Seedling: "bg-lime-100 text-lime-700",
  Vegetative: "bg-green-100 text-green-700",
  Flowering: "bg-pink-100 text-pink-700",
  Fruiting: "bg-orange-100 text-orange-700",
  Harvest: "bg-amber-100 text-amber-700",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default async function DashboardPage() {
  // Mark this as dynamic - required for impure functions like Date.now()
  await connection();

  const session = await requireAuth();
  const role = session.user.role;
  const userId = session.user.id;

  // Fetch user details (firstName not in session type, need DB lookup)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  const userName = user?.firstName ?? "there";

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isFaculty = role === "FACULTY";
  const isStudent = role === "STUDENT_FARMER";

  // Capture "now" once after connection() marker
  const now = new Date();
  const nowMs = now.getTime();
  const oneWeekAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);

  // Role-aware plot filter
  const plotFilter = isStudent
    ? {
        assignments: {
          some: { studentId: userId, status: "ACTIVE" as const },
        },
      }
    : {};

  const [
    plotCount,
    userCount,
    activeAssignmentCount,
    openAlertCount,
    criticalAlertCount,
    recentLogCount,
    recentAlerts,
    recentLogs,
    myPlots,
  ] = await Promise.all([
    prisma.plot.count({ where: plotFilter }),
    isAdmin ? prisma.user.count({ where: { status: "ACTIVE" } }) : Promise.resolve(0),
    prisma.plotAssignment.count({
      where: {
        status: "ACTIVE",
        ...(isStudent ? { studentId: userId } : {}),
        ...(isFaculty ? { facultyId: userId } : {}),
      },
    }),
    prisma.alert.count({
      where: { resolved: false, plot: plotFilter },
    }),
    prisma.alert.count({
      where: { resolved: false, severity: "CRITICAL", plot: plotFilter },
    }),
    prisma.growthLog.count({
      where: {
        createdAt: { gte: oneWeekAgo },
        plot: plotFilter,
      },
    }),
    prisma.alert.findMany({
      where: { resolved: false, plot: plotFilter },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: { plot: { select: { id: true, name: true } } },
    }),
    prisma.growthLog.findMany({
      where: { plot: plotFilter },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        plot: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true, profileImage: true } },
        stage: { select: { name: true } },
        images: { take: 1, orderBy: { createdAt: "asc" }, select: { imageUrl: true } },
      },
    }),
    isStudent
      ? prisma.plot.findMany({
          where: plotFilter,
          orderBy: { name: "asc" },
          take: 6,
          include: {
            crop: { select: { name: true } },
            currentStage: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Only queried when the empty state actually needs it — keeps the common
  // (alerts present) path from paying for an extra round trip.
  const recentlyResolvedAlert =
    recentAlerts.length === 0
      ? await prisma.alert.findFirst({
          where: { resolved: true, resolvedAt: { gte: oneWeekAgo }, plot: plotFilter },
          orderBy: { resolvedAt: "desc" },
          select: { resolvedAt: true },
        })
      : null;

  const moreLogsThisWeek = Math.max(0, recentLogCount - recentLogs.length);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {userName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin && "System overview and recent activity."}
            {isFaculty && "Your students' plots and recent monitoring activity."}
            {isStudent && "Your assigned plots and recent observations."}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 capitalize"
        >
          {role.toLowerCase().replace("_", " ")}
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
        <Link href="/dashboard/plots" data-tour="dashboard.stat-my-plots" className="block h-full">
          <Card className="h-full transition-all hover:shadow-md hover:ring-primary/50 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {isStudent ? "My Plots" : "Total Plots"}
                  </p>
                  <p className="text-2xl font-semibold mt-1">{plotCount}</p>
                </div>
                <div className="p-2 rounded-md bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                  <MapPinned className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/alerts" data-tour="dashboard.stat-alerts" className="block h-full">
          <Card className="h-full transition-all hover:shadow-md hover:ring-primary/50 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Open Alerts
                  </p>
                  <p className="text-2xl font-semibold mt-1">{openAlertCount}</p>
                  {criticalAlertCount > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      {criticalAlertCount} critical
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-md bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <BellRing className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/monitoring" className="block h-full">
          <Card className="h-full transition-all hover:shadow-md hover:ring-primary/50 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Logs This Week
                  </p>
                  <p className="text-2xl font-semibold mt-1">{recentLogCount}</p>
                </div>
                <div className="p-2 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Camera className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {isAdmin ? (
          <Link href="/dashboard/users" className="block h-full">
            <Card className="h-full transition-all hover:shadow-md hover:ring-primary/50 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Active Users
                    </p>
                    <p className="text-2xl font-semibold mt-1">{userCount}</p>
                  </div>
                  <div className="p-2 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Link href="/dashboard/assignments" className="block h-full">
            <Card className="h-full transition-all hover:shadow-md hover:ring-primary/50 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Assignments
                    </p>
                    <p className="text-2xl font-semibold mt-1">
                      {activeAssignmentCount}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-amber-100 text-amber-700">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Student plots */}
      {isStudent && myPlots.length > 0 && (
        <Card data-tour="dashboard.my-plots-grid">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-base">My assigned plots</span>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/plots">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myPlots.map((plot) => (
                <Link
                  key={plot.id}
                  href={`/dashboard/plots/${plot.id}`}
                  className="block p-4 border rounded-md hover:border-green-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{plot.name}</h3>
                    <Sprout className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-500">
                    {plot.crop?.name ?? "No crop"}
                    {plot.currentStage && ` - ${plot.currentStage.name}`}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent alerts + Recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Recent alerts
              </span>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/alerts">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAlerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 mb-3">
                  <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">No open alerts</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {recentlyResolvedAlert?.resolvedAt
                    ? `Last alert resolved ${daysAgoLabel(recentlyResolvedAlert.resolvedAt, nowMs)}`
                    : "All plots within optimal range."}
                </p>
                <div className="mt-3 text-right">
                  <Link
                    href="/dashboard/alerts?status=resolved"
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    View alert history →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/dashboard/plots/${alert.plot.id}`}
                    className="flex items-start gap-3 p-2 -mx-2 rounded hover:bg-gray-50 transition"
                  >
                    <div
                      className={
                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0 " +
                        (alert.severity === "CRITICAL"
                          ? "bg-red-500"
                          : alert.severity === "WARNING"
                          ? "bg-amber-500"
                          : "bg-blue-500")
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {alert.plot.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            alert.severity === "CRITICAL"
                              ? "bg-red-100 text-red-700 text-xs"
                              : "bg-amber-100 text-amber-700 text-xs"
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 truncate">
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {timeAgo(alert.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Recent observations
              </span>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/monitoring">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <EmptyState icon={Camera} title="No growth logs yet" compact />
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => {
                  const initials =
                    `${log.user.firstName[0]}${log.user.lastName[0]}`.toUpperCase();
                  const stageColor = log.stage
                    ? STAGE_BADGE_COLORS[log.stage.name] ?? "bg-gray-100 text-gray-600"
                    : null;
                  const thumbnail = log.images[0]?.imageUrl;
                  return (
                    <Link
                      key={log.id}
                      href={`/dashboard/plots/${log.plot.id}`}
                      className="flex items-start gap-3 p-2 -mx-2 rounded hover:bg-gray-50 transition"
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        {log.user.profileImage && (
                          <AvatarImage src={log.user.profileImage} alt="" />
                        )}
                        <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">
                            {log.user.firstName} {log.user.lastName}
                          </span>
                          <span className="text-gray-500">logged</span>
                          <span className="font-medium text-green-700">
                            {log.plot.name}
                          </span>
                          {log.stage && (
                            <Badge
                              variant="secondary"
                              className={`text-xs h-5 ${stageColor}`}
                            >
                              {log.stage.name}
                            </Badge>
                          )}
                        </div>
                        {log.observations && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                            {truncate(log.observations, OBSERVATION_TRUNCATE_LENGTH)}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {timeAgo(log.createdAt)}
                        </p>
                      </div>
                      {thumbnail && (
                        <Image
                          src={thumbnail}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-md object-cover flex-shrink-0"
                        />
                      )}
                    </Link>
                  );
                })}
                {moreLogsThisWeek > 0 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    {moreLogsThisWeek} more observation{moreLogsThisWeek === 1 ? "" : "s"} this week
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <QuickActions
        role={role}
        studentFirstPlot={
          myPlots[0] ? { id: myPlots[0].id, name: myPlots[0].name } : null
        }
      />
    </div>
  );
}

function daysAgoLabel(date: Date, nowMs: number): string {
  const days = Math.floor((nowMs - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
