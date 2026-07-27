import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ArchivedPlotsTable } from "@/components/plots/archived-plots-table";

export default async function ArchivedPlotsPage() {
  await requireAdmin();

  const archivedPlots = await prisma.plot.findMany({
    where: { status: "ARCHIVED" },
    include: {
      crop: { select: { name: true } },
      _count: { select: { growthLogs: true, sensorReadings: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/plots"
          className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plots
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Archived Plots</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plots archived by administrators. Historical data preserved. Can be
          restored.
        </p>
      </div>

      <ArchivedPlotsTable plots={archivedPlots} />
    </div>
  );
}
