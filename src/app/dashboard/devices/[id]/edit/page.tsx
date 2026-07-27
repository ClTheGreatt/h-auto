import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { DeviceForm } from "@/components/devices/device-form";

export default async function EditDevicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [device, plots] = await Promise.all([
    prisma.device.findUnique({ where: { id } }),
    prisma.plot.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, location: true },
    }),
  ]);

  if (!device) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/devices"
          className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to devices
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          Edit {device.deviceCode}
        </h1>
      </div>

      <DeviceForm
        mode="edit"
        deviceId={device.id}
        plots={plots}
        defaultValues={{
          deviceCode: device.deviceCode,
          plotId: device.plotId,
          firmwareVersion: device.firmwareVersion ?? "",
        }}
      />
    </div>
  );
}