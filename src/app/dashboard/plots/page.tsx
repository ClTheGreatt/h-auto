import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PlotsTable } from "@/components/plots/plots-table";

export default async function PlotsPage() {
  const session = await requireAuth();
  const role = session.user.role;
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";

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
      _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Plots</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === "STUDENT_FARMER"
              ? "Plots assigned to you for monitoring."
              : "Manage vegetable plots and assigned students."}
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/dashboard/plots/new">
              <Plus className="w-4 h-4 mr-2" />
              Add plot
            </Link>
          </Button>
        )}
      </div>

      <PlotsTable plots={plots} canManage={canManage} />
    </div>
  );
}