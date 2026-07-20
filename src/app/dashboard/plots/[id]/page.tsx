import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPinned,
  Sprout,
  Calendar,
  Ruler,
  Plus,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { timeAgo } from "@/lib/format-date";
import { isDeviceOnline } from "@/lib/utils/device-status";
import { canFacultyAccessPlot } from "@/lib/auth/plot-access";
import { PlotAssignments } from "@/components/plots/plot-assignments";
import { RestorePlotDialog } from "@/components/plots/restore-plot-dialog";
import { HarvestPlotDialog } from "@/components/plots/harvest-plot-dialog";
import { UnharvestPlotDialog } from "@/components/plots/unharvest-plot-dialog";
import { LatestReadings } from "@/components/devices/latest-readings";
import { LiveRefresh } from "@/components/plots/live-refresh";
import { GrowthTimeline } from "@/components/growth/growth-timeline";
import type { PlotStatus } from "@prisma/client";

const statusLabels: Record<PlotStatus, string> = {
  PREPARING: "Preparing",
  PLANTED: "Planted",
  GROWING: "Growing",
  READY_FOR_HARVEST: "Ready for harvest",
  HARVESTED: "Harvested",
  FALLOW: "Fallow",
  ARCHIVED: "Archived",
};

const statusColors: Record<PlotStatus, string> = {
  PREPARING: "bg-gray-100 text-gray-700",
  PLANTED: "bg-blue-100 text-blue-700",
  GROWING: "bg-green-100 text-green-700",
  READY_FOR_HARVEST: "bg-amber-100 text-amber-700",
  HARVESTED: "bg-purple-100 text-purple-700",
  FALLOW: "bg-stone-100 text-stone-700",
  ARCHIVED: "bg-gray-200 text-gray-600",
};

export default async function PlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const role = session.user.role;
  const canManageAssignments =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "FACULTY";
  const canEditPlot = role === "SUPER_ADMIN" || role === "ADMIN";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const plot = await prisma.plot.findUnique({
    where: { id },
    include: {
      crop: true,
      currentStage: true,
      device: {
        select: { id: true, deviceCode: true, lastSeenAt: true },
      },
      assignments: {
        where: { status: "ACTIVE" },
        orderBy: { assignedAt: "desc" },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              course: true,
              yearLevel: true,
              section: true,
            },
          },
          faculty: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!plot) notFound();
  if (plot.status === "ARCHIVED" && role !== "SUPER_ADMIN" && role !== "ADMIN") {
    redirect("/dashboard/plots");
  }

  // Admins can view an archived plot (historical data stays inspectable),
  // but every mutating action on it is disabled — restore it first.
  const isArchived = plot.status === "ARCHIVED";
  const isHarvested = plot.status === "HARVESTED";

  if (role === "STUDENT_FARMER") {
    const isAssigned = plot.assignments.some(
      (a) => a.student.id === session.user.id
    );
    if (!isAssigned) redirect("/dashboard/plots");
  }

  if (role === "FACULTY") {
    const hasAccess = await canFacultyAccessPlot(session.user.id, plot.id);
    if (!hasAccess) redirect("/dashboard/plots");
  }

  const isAssignedStudent = plot.assignments.some(
    (a) => a.student.id === session.user.id
  );
  const canLogGrowth = (canManageAssignments || isAssignedStudent) && !isArchived;
  const canManageAssignmentsNow = canManageAssignments && !isArchived;

  const availableStudents = canManageAssignmentsNow
    ? await prisma.user.findMany({
        where: { role: "STUDENT_FARMER", status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          course: true,
          yearLevel: true,
          section: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  const latestReading = await prisma.sensorReading.findFirst({
    where: { plotId: plot.id },
    orderBy: { recordedAt: "desc" },
  });

  // Compute freshly from lastSeenAt rather than trusting device.status,
  // which is only updated periodically by the offline-detection cron.
  const deviceOnline = isDeviceOnline(plot.device?.lastSeenAt);

  const growthLogs = await prisma.growthLog.findMany({
    where: { plotId: plot.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      stage: { select: { name: true } },
      user: { select: { id: true, firstName: true, lastName: true } },
      images: { select: { id: true, imageUrl: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href="/dashboard/plots"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plots
        </Link>

        {isArchived && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 mb-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This plot is archived. Historical data is view-only. Restore
                to make changes.
              </span>
            </div>
            {isAdmin && (
              <RestorePlotDialog
                plotId={plot.id}
                plotName={plot.name}
                trigger={
                  <Button size="sm" className="shrink-0">
                    Restore
                  </Button>
                }
              />
            )}
          </div>
        )}

        {isHarvested && !isArchived && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 mb-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This plot is harvested. Sensor ingest and new growth logs
                are paused. Unmark to resume.
              </span>
            </div>
            {isAdmin && (
              <UnharvestPlotDialog
                plotId={plot.id}
                plotName={plot.name}
                trigger={
                  <Button size="sm" className="shrink-0">
                    Unmark
                  </Button>
                }
              />
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">
                {plot.name}
              </h1>
              <Badge variant="secondary" className={statusColors[plot.status]}>
                {statusLabels[plot.status]}
              </Badge>
            </div>
            {plot.location && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <MapPinned className="w-3 h-3" />
                {plot.location}
              </p>
            )}
          </div>
         <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/plots/${plot.id}/analytics`}>Analytics</Link>
            </Button>
            {canEditPlot && !isArchived && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/plots/${plot.id}/edit`}>Edit plot</Link>
              </Button>
            )}
            {canEditPlot && !isArchived && !isHarvested && (
              <HarvestPlotDialog
                plotId={plot.id}
                plotName={plot.name}
                trigger={
                  <Button variant="outline">Mark as harvested</Button>
                }
              />
            )}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Sprout className="w-4 h-4" />
              Crop
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plot.crop ? (
              <>
                <div className="font-medium">{plot.crop.name}</div>
                <div className="text-xs text-gray-500">
                  {plot.crop.variety ?? "-"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Stage: {plot.currentStage?.name ?? "Not set"}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No crop planted</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-gray-500">Planted:</span>{" "}
              {plot.plantingDate
                ? new Date(plot.plantingDate).toLocaleDateString()
                : "-"}
            </div>
            <div>
              <span className="text-gray-500">Harvest:</span>{" "}
              {plot.expectedHarvest
                ? new Date(plot.expectedHarvest).toLocaleDateString()
                : "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              {plot.sizeSqm ? `${plot.sizeSqm} m2` : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
       <CardTitle className="flex items-center justify-between">
            Sensor readings
            <div className="flex items-center gap-3">
              {plot.device && <LiveRefresh intervalMs={10000} />}
              {plot.device && !latestReading && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Awaiting first reading
                </Badge>
              )}
              {plot.device && latestReading && !deviceOnline && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  Device offline · Last seen{" "}
                  {plot.device.lastSeenAt ? timeAgo(plot.device.lastSeenAt) : "unknown"}
                </Badge>
              )}
              {plot.device && latestReading && deviceOnline && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Live
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      <CardContent>
          {!plot.device ? (
            <div className="text-sm text-gray-500">
              No device linked to this plot yet. Link one from the Devices tab
              to start receiving readings.{" "}
              {canEditPlot && !isArchived && (
                <Link
                  href="/dashboard/devices/new"
                  className="text-green-600 hover:underline font-medium"
                >
                  Link a device
                </Link>
              )}
            </div>
          ) : !latestReading ? (
            <div className="text-sm text-gray-500">
              Device {plot.device.deviceCode} is linked but hasn&apos;t
              reported yet. First reading will appear here.
            </div>
          ) : (
            <LatestReadings reading={latestReading} stage={plot.currentStage} />
          )}
          {latestReading && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href={`/dashboard/plots/${plot.id}/readings`}
                className="text-sm font-medium text-green-600 hover:text-green-700 inline-flex items-center gap-1"
              >
                View all readings
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour="plot.assign-card">
        <CardHeader>
          <CardTitle>Monitoring assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <PlotAssignments
            plotId={plot.id}
            assignments={plot.assignments}
            availableStudents={availableStudents}
            canManage={canManageAssignmentsNow}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Growth log
            {canLogGrowth && (
              <Button size="sm" asChild>
                <Link href={`/dashboard/plots/${plot.id}/log/new`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add log entry
                </Link>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GrowthTimeline
            logs={growthLogs}
            currentUserId={session.user.id}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  </div>
  );
}
