import Link from "next/link";
import { Camera, Activity, Sprout } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MonitoringPage() {
  const session = await requireAuth();
  const role = session.user.role;

  // Students see only their assigned plots; faculty/admin see all
  const where =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : {};

  const plots = await prisma.plot.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      crop: { select: { name: true } },
      currentStage: { select: { name: true } },
      _count: { select: { growthLogs: true } },
      growthLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Monitoring</h1>
        <p className="text-sm text-gray-500 mt-1">
          {role === "STUDENT_FARMER"
            ? "Plots assigned to you. Click a plot to log observations and upload photos."
            : "All plots being monitored. Click into one to view its growth timeline."}
        </p>
      </div>

      {plots.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
          <Activity className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          {role === "STUDENT_FARMER"
            ? "You haven't been assigned to any plots yet."
            : "No plots to monitor yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plots.map((plot) => {
            const lastLog = plot.growthLogs[0]?.createdAt;
            return (
              <Link
                key={plot.id}
                href={`/dashboard/plots/${plot.id}`}
                className="block"
              >
                <Card className="hover:shadow-md hover:border-green-300 transition cursor-pointer">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="font-semibold">{plot.name}</h2>
                        {plot.location && (
                          <p className="text-xs text-gray-500">
                            {plot.location}
                          </p>
                        )}
                      </div>
                      <Sprout className="w-5 h-5 text-green-500" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {plot.crop && (
                        <Badge variant="secondary">{plot.crop.name}</Badge>
                      )}
                      {plot.currentStage && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700"
                        >
                          {plot.currentStage.name}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                      <span className="flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        {plot._count.growthLogs} log
                        {plot._count.growthLogs !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {lastLog
                          ? `Last: ${new Date(lastLog).toLocaleDateString()}`
                          : "No logs yet"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}