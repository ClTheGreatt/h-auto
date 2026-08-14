"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, Check, AlertCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RequiredMark } from "@/components/ui/form-helpers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deviceSchema, type DeviceFormValues } from "@/lib/validations/device";
import { createDevice, updateDevice } from "@/actions/devices";
import { ADMIN_SETTABLE_DEVICE_STATUSES } from "@/lib/utils/device-status";
import type { DeviceStatus } from "@prisma/client";

type PlotOption = {
  id: string;
  name: string;
  location: string | null;
};

// Sentinel for the status Select's "no change" option (ONLINE/OFFLINE case
// only) — maps back to field value `undefined`, never a literal ONLINE/
// OFFLINE string. Same idiom as NO_CROP/NO_FACULTY in plot-form.tsx.
const NO_STATUS_CHANGE = "__no_change__";

// Same idiom plots-table.tsx/plot-form.tsx use for PlotStatus — a small
// local map, not imported from devices-table.tsx (a "use client" list
// component, not a shared-constants module).
const STATUS_LABELS: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};
const STATUS_VARIANT: Record<DeviceStatus, StatusVariant> = {
  ONLINE: "success",
  OFFLINE: "danger",
  MAINTENANCE: "warning",
  RETIRED: "neutral",
};

export function DeviceForm({
  mode,
  deviceId,
  plots,
  defaultValues,
  readingsCount = 0,
}: {
  mode: "create" | "edit";
  deviceId?: string;
  plots: PlotOption[];
  defaultValues?: Partial<DeviceFormValues>;
  // Existing readings on this device — used only to word the move-plot
  // confirmation (FIX 3). Always 0/unused in create mode.
  readingsCount?: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);

  // Whether the device's CURRENT status (as loaded, not the live form
  // value) is already one the admin declared by hand. Drives which
  // transitions the Select offers below — computed once from the original
  // value, not re-derived as the admin picks a different option, so the
  // offered set doesn't shift under them mid-edit.
  const isCurrentlyManual =
    !!defaultValues?.status &&
    ADMIN_SETTABLE_DEVICE_STATUSES.includes(defaultValues.status);

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      deviceCode: defaultValues?.deviceCode ?? "",
      plotId: defaultValues?.plotId ?? "",
      firmwareVersion: defaultValues?.firmwareVersion ?? "",
      // ONLINE/OFFLINE are never a valid submission (system-driven only),
      // so they're deliberately not seeded here even though that's the
      // device's real current value — the Select starts unselected
      // ("No change") rather than pre-showing a status it could never
      // actually resubmit.
      status: isCurrentlyManual ? defaultValues?.status : undefined,
    },
  });

  const watchedPlotId = useWatch({ control: form.control, name: "plotId" });
  // Only prompt when the plot actually changes — not on a name-only edit,
  // and never in create mode (there's no "previous plot" yet).
  const needsMoveConfirm =
    mode === "edit" &&
    !!defaultValues?.plotId &&
    watchedPlotId !== defaultValues.plotId;

  async function onSubmit(values: DeviceFormValues) {
    setSubmitting(true);
    const result =
      mode === "create"
        ? await createDevice(values)
        : await updateDevice(deviceId!, values);

    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

   if (mode === "create" && result && "apiKey" in result && typeof result.apiKey === "string") {
      setGeneratedKey(result.apiKey);
      toast.success("Device registered. Copy the API key below.");
      return;
    }

    toast.success(mode === "create" ? "Device created" : "Device updated");
    router.push("/dashboard/devices");
    router.refresh();
  }

  async function copyKey() {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    toast.success("API key copied");
    setTimeout(() => setCopied(false), 2000);
  }

  if (generatedKey) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Save this API key now
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-amber-900">
            This key authenticates your ESP32 device with the server. It will
            only be shown once. Save it somewhere safe — you&apos;ll paste it
            into your firmware code.
          </p>
          <div className="bg-card border border-amber-300 rounded-md p-3 font-mono text-xs break-all">
            {generatedKey}
          </div>
          <div className="flex gap-3">
            <Button onClick={copyKey} variant="outline">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy API key
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                router.push("/dashboard/devices");
                router.refresh();
              }}
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Device information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="deviceCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device code <RequiredMark /></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ESP32-A1" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    A unique identifier you give the physical device.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked plot <RequiredMark /></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plot" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plots.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.location ? ` — ${p.location}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firmwareVersion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firmware version</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 1.0.0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Status is always visible (the badge shows the real current
                value) and always editable (the Select below it) — the
                admin can move INTO Maintenance/Retired from anywhere, and
                once already there, move to the other one or back to
                automatic tracking. ONLINE is never a selectable target —
                it's exclusively set by ingest on an accepted reading.
                "Resume automatic tracking" submits OFFLINE under the hood
                (the honest, conservative resting value: it doesn't claim
                liveness that hasn't actually been confirmed, and the very
                next accepted reading or the offline cron will correct it
                either way) — but it's offered as a distinct labeled
                action, not as a raw "Offline" status pick, and only
                appears once there's something to resume FROM. Create mode
                has no existing status to show at all. */}
            {mode === "edit" && defaultValues?.status && (
              <div>
                <FormLabel>Status</FormLabel>
                <div className="mt-2 mb-2">
                  <StatusBadge variant={STATUS_VARIANT[defaultValues.status]}>
                    {STATUS_LABELS[defaultValues.status]}
                  </StatusBadge>
                </div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={(v) =>
                          field.onChange(v === NO_STATUS_CHANGE ? undefined : v)
                        }
                        value={field.value ?? NO_STATUS_CHANGE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Only offered when there's nothing pre-selected
                              to fall back to (ONLINE/OFFLINE case) — once a
                              real status is picked, this is how to get back
                              to "don't submit a status at all", without
                              ever transmitting ONLINE/OFFLINE literally. The
                              MAINTENANCE/RETIRED case doesn't need this: its
                              own current value stays listed below and stays
                              clickable, so reverting is just re-picking it. */}
                          {!isCurrentlyManual && (
                            <SelectItem value={NO_STATUS_CHANGE}>No change</SelectItem>
                          )}
                          {ADMIN_SETTABLE_DEVICE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                          {isCurrentlyManual && (
                            <SelectItem value="OFFLINE">
                              Resume automatic tracking
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        {isCurrentlyManual
                          ? "Won't trigger offline alerts while Maintenance or Retired. Resume automatic tracking to let ingest and the offline monitor manage its status again."
                          : "Mark Maintenance or Retired to take this device out of automatic offline-alert tracking."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {mode === "create" && (
          <p className="text-xs text-muted-foreground">
            The device API key is shown only once after registration. Copy it
            immediately.
          </p>
        )}
        <div className="flex gap-3">
          {needsMoveConfirm ? (
            <AlertDialog open={moveConfirmOpen} onOpenChange={setMoveConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={submitting}>
                  {submitting ? "Saving..." : "Save changes"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Move this device to a different plot?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {readingsCount === 0
                      ? "This device has no existing readings, so nothing is left behind."
                      : readingsCount === 1
                      ? "This device has 1 existing reading. It will stay attributed to the current plot — it will not follow the device."
                      : `This device has ${readingsCount} existing readings. They will stay attributed to the current plot — they will not follow the device.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                  {/* Default styling, not red — this is an awareness prompt
                      about historical-data attribution, not a destructive
                      confirm. Nothing is deleted by this save. */}
                  <AlertDialogAction
                    disabled={submitting}
                    onClick={(e) => {
                      e.preventDefault();
                      setMoveConfirmOpen(false);
                      form.handleSubmit(onSubmit)();
                    }}
                  >
                    {submitting ? "Saving..." : "Save changes"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving..."
                : mode === "create"
                ? "Register device"
                : "Save changes"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/devices")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}