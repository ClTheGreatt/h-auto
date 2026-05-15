import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { DeviceForm } from "@/components/devices/device-form";

export default async function NewDevicePage() {
  await requireAdmin();

  // Only show plots that don't already have a device
  const plots = await prisma.plot.findMany({
    where: { device: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, location: true },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/devices"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to devices
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Register device</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add a new ESP32 device and generate its API key for authentication.
        </p>
      </div>

      <DeviceForm mode="create" plots={plots} />
    </div>
  );
}