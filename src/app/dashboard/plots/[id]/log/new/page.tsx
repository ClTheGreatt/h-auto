import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { GrowthLogForm } from "@/components/growth/growth-log-form";

export default async function NewGrowthLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const role = session.user.role;

  const plot = await prisma.plot.findUnique({
    where: { id },
    include: {
      crop: {
        include: {
          stages: { orderBy: { orderIndex: "asc" } },
        },
      },
      assignments: {
        where: { status: "ACTIVE" },
        select: { studentId: true },
      },
    },
  });

  if (!plot) notFound();

  // Access control: admins/faculty allowed; students only if assigned
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "FACULTY";
  const isAssignedStudent = plot.assignments.some(
    (a) => a.studentId === session.user.id
  );

  if (!isAdmin && !isAssignedStudent) {
    redirect("/dashboard/monitoring");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href={`/dashboard/plots/${plot.id}`}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {plot.name}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Add log entry</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record observations, measurements, and photos for {plot.name}.
        </p>
      </div>

      <GrowthLogForm
        plotId={plot.id}
        stages={plot.crop?.stages ?? []}
        currentStageId={plot.currentStageId}
      />
    </div>
  );
}