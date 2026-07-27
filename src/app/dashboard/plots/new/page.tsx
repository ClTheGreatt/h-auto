import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { PlotForm } from "@/components/plots/plot-form";

export default async function NewPlotPage() {
  await requireAdmin();

  // A brand-new plot should never be assignable to an archived crop.
  const crops = await prisma.crop.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      stages: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, orderIndex: true },
      },
    },
  });

  const faculty = await prisma.user.findMany({
    where: { role: "FACULTY", status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/plots"
          className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plots
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Add plot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new vegetable plot and optionally assign a crop.
        </p>
      </div>

      <PlotForm
        mode="create"
        crops={crops.map((c) => ({
          id: c.id,
          name: c.name,
          daysToHarvest: c.daysToHarvest,
          stages: c.stages,
        }))}
        faculty={faculty}
      />
    </div>
  );
}