import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { CropForm } from "@/components/crops/crop-form";
import { toCustomPreset } from "@/lib/crops/custom-presets";

export default async function NewCropPage() {
  await requireAdmin();

  // Archived crops never appear in the Quick start dropdown, promoted or not.
  const presetCrops = await prisma.crop.findMany({
    where: { isPreset: true, status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      stages: { orderBy: { orderIndex: "asc" } },
    },
  });
  const customPresets = presetCrops.map(toCustomPreset);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href="/dashboard/crops"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to crops
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Add crop</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new crop profile with growth stages and ideal thresholds.
        </p>
      </div>

      <CropForm mode="create" customPresets={customPresets} />
    </div>
  );
}