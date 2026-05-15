"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, Check, AlertCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { deviceSchema, type DeviceFormValues } from "@/lib/validations/device";
import { createDevice, updateDevice } from "@/actions/devices";

type PlotOption = {
  id: string;
  name: string;
  location: string | null;
};

export function DeviceForm({
  mode,
  deviceId,
  plots,
  defaultValues,
}: {
  mode: "create" | "edit";
  deviceId?: string;
  plots: PlotOption[];
  defaultValues?: Partial<DeviceFormValues>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      deviceCode: defaultValues?.deviceCode ?? "",
      plotId: defaultValues?.plotId ?? "",
      firmwareVersion: defaultValues?.firmwareVersion ?? "",
    },
  });

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

    if (mode === "create" && result && "apiKey" in result && result.apiKey) {
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
          <div className="bg-white border border-amber-300 rounded-md p-3 font-mono text-xs break-all">
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
                  <FormLabel>Device code *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ESP32-A1" {...field} />
                  </FormControl>
                  <p className="text-xs text-gray-500">
                    A unique identifier you give the physical device.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked plot *</FormLabel>
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
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving..."
              : mode === "create"
              ? "Register device"
              : "Save changes"}
          </Button>
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