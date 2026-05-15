import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { PlotForm } from "@/components/plots/plot-form";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

export default async function EditPlotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [plot, crops] = await Promise.all([
    prisma.plot.findUnique({ where: { id } }),
    prisma.crop.findMany({
      orderBy: { name: "asc" },
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, name: true, orderIndex: true },
        },
      },
    }),
  ]);

  if (!plot) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/plots"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plots
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit {plot.name}</h1>
      </div>

      <PlotForm
        mode="edit"
        plotId={plot.id}
        crops={crops.map((c) => ({
          id: c.id,
          name: c.name,
          daysToHarvest: c.daysToHarvest,
          stages: c.stages,
        }))}
        defaultValues={{
          name: plot.name,
          location: plot.location ?? "",
          sizeSqm: plot.sizeSqm,
          cropId: plot.cropId,
          currentStageId: plot.currentStageId,
          plantingDate: toDateInput(plot.plantingDate),
          expectedHarvest: toDateInput(plot.expectedHarvest),
          status: plot.status,
        }}
      />
    </div>
  );
}