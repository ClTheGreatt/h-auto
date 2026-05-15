import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { CropsTable } from "@/components/crops/crops-table";

export default async function CropsPage() {
  await requireAdmin();

  const crops = await prisma.crop.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      variety: true,
      daysToHarvest: true,
      _count: { select: { stages: true, plots: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Crops</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage crop profiles and ideal thresholds for each growth stage.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/crops/new">
            <Plus className="w-4 h-4 mr-2" />
            Add crop
          </Link>
        </Button>
      </div>

      <CropsTable crops={crops} />
    </div>
  );
}