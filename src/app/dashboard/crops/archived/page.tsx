import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ArchivedCropsTable } from "@/components/crops/archived-crops-table";

export default async function ArchivedCropsPage() {
  await requireAdmin();

  const archivedCrops = await prisma.crop.findMany({
    where: { status: "ARCHIVED" },
    include: {
      _count: { select: { plots: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/crops"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to crops
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Archived Crops</h1>
        <p className="text-sm text-gray-500 mt-1">
          Crops archived by administrators. Historical data preserved. Can be
          restored.
        </p>
      </div>

      <ArchivedCropsTable crops={archivedCrops} />
    </div>
  );
}
