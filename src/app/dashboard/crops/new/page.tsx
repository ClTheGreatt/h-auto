import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { CropForm } from "@/components/crops/crop-form";

export default async function NewCropPage() {
  await requireAdmin();

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

      <CropForm mode="create" />
    </div>
  );
}