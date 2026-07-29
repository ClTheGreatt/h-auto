"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Cpu,
  Zap,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  simulateReading,
  deleteDevice,
  regenerateApiKey,
} from "@/actions/devices";
import type { DeviceStatus } from "@prisma/client";
import {
  getDeviceFreshness,
  type DeviceFreshnessState,
} from "@/lib/utils/device-status";
import { formatDateTime } from "@/lib/format-date";

type DeviceRow = {
  id: string;
  deviceCode: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  firmwareVersion: string | null;
  plot: { id: string; name: string; location: string | null };
  _count: { readings: number };
};

const SIMULATION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SIMULATION === "true";

const statusVariant: Record<DeviceStatus, StatusVariant> = {
  ONLINE: "success",
  OFFLINE: "danger",
  MAINTENANCE: "warning",
  RETIRED: "neutral",
};

const freshnessVariant: Record<DeviceFreshnessState, StatusVariant> = {
  FRESH: "success",
  STALE: "warning",
  OFFLINE: "danger",
  NEVER_REPORTED: "neutral",
};

const freshnessLabel: Record<DeviceFreshnessState, string> = {
  FRESH: "Fresh",
  STALE: "Stale",
  OFFLINE: "Offline",
  NEVER_REPORTED: "Never reported",
};

export function DevicesTable({
  devices,
  nowMs,
}: {
  devices: DeviceRow[];
  nowMs: number;
}) {
  const router = useRouter();
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  async function handleSimulate(id: string) {
    setSimulatingId(id);
    const result = await simulateReading(id);
    setSimulatingId(null);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Simulated reading created");
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteDevice(deleteId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Device deleted");
    setDeleteId(null);
    router.refresh();
  }

  async function handleRegen() {
    if (!regenId) return;
    const result = await regenerateApiKey(regenId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setNewKey(result.apiKey!);
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={Cpu}
        title="No devices registered yet"
        description='Click "Register device" to add one.'
      />
    );
  }

  return (
    <>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device code</TableHead>
              <TableHead>Plot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Firmware</TableHead>
              <TableHead>Readings</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const freshness = getDeviceFreshness(d.lastSeenAt, nowMs);
              const administrativeStatus =
                d.status === "MAINTENANCE" || d.status === "RETIRED"
                  ? d.status
                  : null;

              return (
                <TableRow key={d.id}>
                <TableCell className="font-medium font-mono text-sm">
                  {d.deviceCode}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/plots/${d.plot.id}`}
                    className="text-sm hover:underline"
                  >
                    {d.plot.name}
                  </Link>
                  {d.plot.location && (
                    <div className="text-xs text-muted-foreground">{d.plot.location}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge variant={freshnessVariant[freshness.state]}>
                      {freshnessLabel[freshness.state]}
                    </StatusBadge>
                    {administrativeStatus && (
                      <StatusBadge variant={statusVariant[administrativeStatus]}>
                        {administrativeStatus}
                      </StatusBadge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.lastSeenAt
                    ? formatDateTime(d.lastSeenAt)
                    : "Never reported"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.firmwareVersion ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d._count.readings}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {SIMULATION_ENABLED && (
                        <DropdownMenuItem
                          onClick={() => handleSimulate(d.id)}
                          disabled={simulatingId === d.id}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {simulatingId === d.id
                            ? "Simulating..."
                            : "Simulate reading"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/devices/${d.id}/edit`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setRegenId(d.id);
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate API key
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeleteId(d.id);
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this device?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the device and all its sensor
              readings. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate API key confirmation */}
      <AlertDialog
        open={!!regenId && !newKey}
        onOpenChange={(open) => !open && setRegenId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API key?</AlertDialogTitle>
            <AlertDialogDescription>
              The current key will stop working immediately. You&apos;ll need to
              update the firmware on your ESP32 with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRegen();
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New API key reveal */}
      <AlertDialog
        open={!!newKey}
        onOpenChange={(open) => {
          if (!open) {
            setNewKey(null);
            setRegenId(null);
            router.refresh();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New API key</AlertDialogTitle>
            <AlertDialogDescription>
              Save this key now — it will only be shown once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted border rounded-md p-3 font-mono text-xs break-all">
            {newKey}
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!newKey) return;
                await navigator.clipboard.writeText(newKey);
                setKeyCopied(true);
                setTimeout(() => setKeyCopied(false), 2000);
              }}
            >
              {keyCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <AlertDialogAction onClick={() => setNewKey(null)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
