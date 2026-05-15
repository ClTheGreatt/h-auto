import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  MapPinned,
  Sprout,
  Calendar,
  Ruler,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PlotAssignments } from "@/components/plots/plot-assignments";
import { LatestReadings } from "@/components/devices/latest-readings";
import { GrowthTimeline } from "@/components/growth/growth-timeline";
import type { PlotStatus } from "@prisma/client";

const statusLabels: Record<PlotStatus, string> = {
  PREPARING: "Preparing",
  PLANTED: "Planted",
  GROWING: "Growing",
  READY_FOR_HARVEST: "Ready for harvest",
  HARVESTED: "Harvested",
  FALLOW: "Fallow",
};

const statusColors: Record<PlotStatus, string> = {
  PREPARING: "bg-gray-100 text-gray-700",
  PLANTED: "bg-blue-100 text-blue-700",
  GROWING: "bg-green-100 text-green-700",
  READY_FOR_HARVEST: "bg-amber-100 text-amber-700",
  HARVESTED: "bg-purple-100 text-purple-700",
  FALLOW: "bg-stone-100 text-stone-700",
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
      device: { select: { id: true, deviceCode: true, status: true } },
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
            },
          },
          faculty: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!plot) notFound();

  if (role === "STUDENT_FARMER") {
    const isAssigned = plot.assignments.some(
      (a) => a.student.id === session.user.id
    );
    if (!isAssigned) redirect("/dashboard/plots");
  }

  const isAssignedStudent = plot.assignments.some(
    (a) => a.student.id === session.user.id
  );
  const canLogGrowth = canManageAssignments || isAssignedStudent;

  const availableStudents = canManageAssignments
    ? await prisma.user.findMany({
        where: { role: "STUDENT_FARMER", status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          course: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  const latestReading = await prisma.sensorReading.findFirst({
    where: { plotId: plot.id },
    orderBy: { recordedAt: "desc" },
  });

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
            {canEditPlot && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/plots/${plot.id}/edit`}>Edit plot</Link>
              </Button>
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
            {plot.device && (
              <Badge
                variant="secondary"
                className={
                  plot.device.status === "ONLINE"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }
              >
                {plot.device.deviceCode} - {plot.device.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!plot.device ? (
            <div className="text-sm text-gray-500">
              No device linked to this plot.{" "}
              {canEditPlot && (
                <Link
                  href="/dashboard/devices/new"
                  className="text-green-600 hover:underline"
                >
                  Register a device
                </Link>
              )}
            </div>
          ) : (
            <LatestReadings reading={latestReading} stage={plot.currentStage} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitoring assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <PlotAssignments
            plotId={plot.id}
            assignments={plot.assignments}
            availableStudents={availableStudents}
            canManage={canManageAssignments}
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
