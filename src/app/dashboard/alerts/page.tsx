import { Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { Badge } from "@/components/ui/badge";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const role = session.user.role;
  const canResolve =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "FACULTY";

  const showResolved = params.status === "resolved";

  // Filter alerts by plot visibility for students
  const plotFilter =
    role === "STUDENT_FARMER"
      ? {
          plot: {
            assignments: {
              some: { studentId: session.user.id, status: "ACTIVE" as const },
            },
          },
        }
      : {};

  const alerts = await prisma.alert.findMany({
    where: {
      resolved: showResolved,
      ...plotFilter,
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    include: {
      plot: { select: { id: true, name: true } },
      notifications: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
    take: 100,
  });

  const openCount = await prisma.alert.count({
    where: { resolved: false, ...plotFilter },
  });
  const resolvedCount = await prisma.alert.count({
    where: { resolved: true, ...plotFilter },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Environmental conditions outside the ideal thresholds for each plot&apos;s
          current growth stage.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <a
          href="/dashboard/alerts"
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (!showResolved
              ? "bg-green-100 text-green-700 font-medium"
              : "text-gray-600 hover:bg-gray-100")
          }
        >
          Open
          <Badge variant="secondary" className="ml-2 text-xs">
            {openCount}
          </Badge>
        </a>
        <a
          href="/dashboard/alerts?status=resolved"
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (showResolved
              ? "bg-green-100 text-green-700 font-medium"
              : "text-gray-600 hover:bg-gray-100")
          }
        >
          Resolved
          <Badge variant="secondary" className="ml-2 text-xs">
            {resolvedCount}
          </Badge>
        </a>
      </div>

      <AlertsTable alerts={alerts} canResolve={canResolve} />
    </div>
  );
}