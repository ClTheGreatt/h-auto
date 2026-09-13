import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { GrowthLogForm } from "@/components/growth/growth-log-form";
import { buildDirectPlotAccessWhere } from "@/lib/auth/plot-access";
import { isActivityPlotStatus } from "@/lib/plots/lifecycle";

export default async function NewGrowthLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const role = session.user.role;

  const plot = await prisma.plot.findFirst({
    where: buildDirectPlotAccessWhere(role, session.user.id, id),
    include: {
      crop: {
        include: {
          stages: { orderBy: { orderIndex: "asc" } },
        },
      },
    },
  });

  if (!plot) notFound();

  if (!isActivityPlotStatus(plot.status)) {
    redirect(`/dashboard/plots/${plot.id}`);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href={`/dashboard/plots/${plot.id}`}
          className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {plot.name}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Add log entry</h1>
        <p className="text-sm text-muted-foreground mt-1">
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
