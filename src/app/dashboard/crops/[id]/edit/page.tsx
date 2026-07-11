import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { CropForm } from "@/components/crops/crop-form";

export default async function EditCropPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const crop = await prisma.crop.findUnique({
    where: { id },
    include: {
      stages: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!crop) notFound();

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
        <h1 className="text-2xl font-semibold text-gray-900">Edit {crop.name}</h1>
        {crop.variety && (
          <p className="text-sm text-gray-500 mt-1">{crop.variety}</p>
        )}
      </div>

      <CropForm
        mode="edit"
        cropId={crop.id}
        defaultValues={{
          name: crop.name,
          variety: crop.variety ?? "",
          description: crop.description ?? "",
          daysToHarvest: crop.daysToHarvest,
          cultivationGuide: crop.cultivationGuide ?? "",
          stages: crop.stages.map((s) => ({
            name: s.name,
            orderIndex: s.orderIndex,
            durationDays: s.durationDays,
            description: s.description ?? "",
            minSoilMoisture: s.minSoilMoisture,
            maxSoilMoisture: s.maxSoilMoisture,
            minTemperature: s.minTemperature,
            maxTemperature: s.maxTemperature,
            minHumidity: s.minHumidity,
            maxHumidity: s.maxHumidity,
            minLightIntensity: s.minLightIntensity,
            maxLightIntensity: s.maxLightIntensity,
            minNitrogen: s.minNitrogen,
            maxNitrogen: s.maxNitrogen,
            minPhosphorus: s.minPhosphorus,
            maxPhosphorus: s.maxPhosphorus,
            minPotassium: s.minPotassium,
            maxPotassium: s.maxPotassium,
          })),
        }}
      />
    </div>
  );
}