import Link from "next/link";
import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { DevicesTable } from "@/components/devices/devices-table";

export default async function DevicesPage() {
  await requireAdmin();

  const devices = await prisma.device.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plot: { select: { id: true, name: true, location: true } },
      _count: { select: { readings: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">IoT Devices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Register ESP32 devices and link them to plots for real-time monitoring.
          </p>
        </div>
        <Button data-tour="devices.register-button" asChild>
          <Link href="/dashboard/devices/new">
            <Plus className="w-4 h-4 mr-2" />
            Register device
          </Link>
        </Button>
      </div>

      {process.env.NEXT_PUBLIC_ENABLE_SIMULATION === "true" && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>Testing without hardware?</strong> Use the &quot;Simulate
            reading&quot; option from the menu on each device to generate fake
            sensor data. Useful for development and demo before your physical
            ESP32 arrives.
          </div>
        </div>
      )}

      <div data-tour="devices.list">
        <DevicesTable devices={devices} />
      </div>
    </div>
  );
}
