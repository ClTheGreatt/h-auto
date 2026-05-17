import { connection } from "next/server";
import Link from "next/link";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { QuickActions } from "@/components/dashboard/quick-actions";
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
        user: { select: { firstName: true, lastName: true } },
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

  function timeAgo(date: Date): string {
    const seconds = Math.floor((nowMs - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {userName} 👋
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {isStudent ? "My Plots" : "Total Plots"}
                </p>
                <p className="text-2xl font-semibold mt-1">{plotCount}</p>
              </div>
              <div className="p-2 rounded-md bg-green-100 text-green-700">
                <MapPinned className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
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
              <div
                className={
                  "p-2 rounded-md " +
                  (openAlertCount > 0
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-500")
                }
              >
                <BellRing className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Logs This Week
                </p>
                <p className="text-2xl font-semibold mt-1">{recentLogCount}</p>
              </div>
              <div className="p-2 rounded-md bg-blue-100 text-blue-700">
                <Camera className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Active Users
                  </p>
                  <p className="text-2xl font-semibold mt-1">{userCount}</p>
                </div>
                <div className="p-2 rounded-md bg-purple-100 text-purple-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
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
        )}
      </div>

      {/* Student plots */}
      {isStudent && myPlots.length > 0 && (
        <Card>
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
              <div className="text-center py-8 text-sm text-gray-500">
                <BellRing className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                No open alerts. All plots within optimal range.
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
              <div className="text-center py-8 text-sm text-gray-500">
                <Camera className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                No growth logs yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => {
                  const initials =
                    `${log.user.firstName[0]}${log.user.lastName[0]}`.toUpperCase();
                  return (
                    <Link
                      key={log.id}
                      href={`/dashboard/plots/${log.plot.id}`}
                      className="flex items-start gap-3 p-2 -mx-2 rounded hover:bg-gray-50 transition"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium">
                            {log.user.firstName} {log.user.lastName}
                          </span>
                          <span className="text-gray-500">
                            {" "}
                            logged {log.plot.name}
                          </span>
                        </div>
                        {log.observations && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                            {log.observations}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {timeAgo(log.createdAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <QuickActions
        role={role}
        openAlertCount={openAlertCount}
        criticalAlertCount={criticalAlertCount}
        studentFirstPlot={
          myPlots[0] ? { id: myPlots[0].id, name: myPlots[0].name } : null
        }
      />
    </div>
  );
}