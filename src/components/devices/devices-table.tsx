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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type DeviceRow = {
  id: string;
  deviceCode: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  firmwareVersion: string | null;
  plot: { name: string; location: string | null };
  _count: { readings: number };
};

const statusColors: Record<DeviceStatus, string> = {
  ONLINE: "bg-green-100 text-green-700 hover:bg-green-100",
  OFFLINE: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  MAINTENANCE: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  RETIRED: "bg-red-100 text-red-700 hover:bg-red-100",
};

export function DevicesTable({
  devices,
}: {
  devices: DeviceRow[];
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

  function formatLastSeen(date: Date | null): string {
    if (!date) return "Never";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
        <Cpu className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        No devices registered yet. Click &quot;Register device&quot; to add one.
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-md bg-white">
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
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium font-mono text-sm">
                  {d.deviceCode}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/plots/${d.plot.name}`}
                    className="text-sm hover:underline"
                  >
                    {d.plot.name}
                  </Link>
                  {d.plot.location && (
                    <div className="text-xs text-gray-500">{d.plot.location}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[d.status]}>
                    {d.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatLastSeen(d.lastSeenAt)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {d.firmwareVersion ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
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
                      <DropdownMenuItem
                        onClick={() => handleSimulate(d.id)}
                        disabled={simulatingId === d.id}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {simulatingId === d.id
                          ? "Simulating..."
                          : "Simulate reading"}
                      </DropdownMenuItem>
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
            ))}
          </TableBody>
        </Table>
      </div>

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
          <div className="bg-gray-50 border rounded-md p-3 font-mono text-xs break-all">
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
