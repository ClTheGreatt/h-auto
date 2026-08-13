"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { plotSchema, type PlotFormValues } from "@/lib/validations/plot";
import { createPlot, updatePlot } from "@/actions/plots";
import type { PlotStatus } from "@prisma/client";

// Same mapping plots-table.tsx uses for the Plots list — the shared,
// reusable status-badge idiom. Plot Detail's own status badge is a
// page-local Badge+color map, not exported, so it isn't reusable here.
const STATUS_LABELS: Record<PlotStatus, string> = {
  PREPARING: "Preparing",
  PLANTED: "Planted",
  GROWING: "Growing",
  READY_FOR_HARVEST: "Ready for harvest",
  HARVESTED: "Harvested",
  FALLOW: "Fallow",
  ARCHIVED: "Archived",
};
const STATUS_VARIANT: Record<PlotStatus, StatusVariant> = {
  PREPARING: "neutral",
  PLANTED: "info",
  GROWING: "success",
  READY_FOR_HARVEST: "warning",
  HARVESTED: "success",
  FALLOW: "neutral",
  ARCHIVED: "neutral",
};

type CropOption = {
  id: string;
  name: string;
  daysToHarvest: number;
  stages: Array<{ id: string; name: string; orderIndex: number }>;
};

type FacultyOption = { id: string; firstName: string; lastName: string };

type PlotFormProps = {
  mode: "create" | "edit";
  plotId?: string;
  crops: CropOption[];
  faculty: FacultyOption[];
  defaultValues?: Partial<PlotFormValues>;
};

const NO_CROP = "__none__";
const NO_FACULTY = "__no_faculty__";

export function PlotForm({ mode, plotId, crops, faculty, defaultValues }: PlotFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      location: defaultValues?.location ?? "",
      sizeSqm: defaultValues?.sizeSqm ?? null,
      cropId: defaultValues?.cropId ?? null,
      facultyId: defaultValues?.facultyId ?? null,
      currentStageId: defaultValues?.currentStageId ?? null,
      plantingDate: defaultValues?.plantingDate ?? "",
      expectedHarvest: defaultValues?.expectedHarvest ?? "",
      status: defaultValues?.status ?? "PREPARING",
    },
  });

  const watchedCropId = useWatch({ control: form.control, name: "cropId" });
  const watchedPlantingDate = useWatch({
    control: form.control,
    name: "plantingDate",
  });

  const selectedCrop = crops.find((c) => c.id === watchedCropId);
  const stageOptions = selectedCrop?.stages ?? [];

  // Auto-compute expected harvest when planting date changes
  function handlePlantingDateChange(value: string) {
    form.setValue("plantingDate", value);
    if (value && selectedCrop) {
      const planting = new Date(value);
      const harvest = new Date(planting);
      harvest.setDate(harvest.getDate() + selectedCrop.daysToHarvest);
      form.setValue("expectedHarvest", harvest.toISOString().split("T")[0]);
    }
  }

  function handleCropChange(value: string) {
    const newCropId = value === NO_CROP ? null : value;
    form.setValue("cropId", newCropId);
    form.setValue("currentStageId", null);

    // Recompute expected harvest if there's a planting date
    if (watchedPlantingDate && newCropId) {
      const newCrop = crops.find((c) => c.id === newCropId);
      if (newCrop) {
        const planting = new Date(watchedPlantingDate);
        const harvest = new Date(planting);
        harvest.setDate(harvest.getDate() + newCrop.daysToHarvest);
        form.setValue("expectedHarvest", harvest.toISOString().split("T")[0]);
      }
    }
  }

  async function onSubmit(values: PlotFormValues) {
    setSubmitting(true);

    if (mode === "create") {
      const result = await createPlot(values);
      setSubmitting(false);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Plot created");
      router.push(`/dashboard/plots/${result.id}`);
      router.refresh();
      return;
    }

    const result = await updatePlot(plotId!, values);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Plot updated");
    router.back();
    // Refresh so the page we return to shows the updated data
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Plot information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <RequiredMark /></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Plot A1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Greenhouse North" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sizeSqm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Size (square meters)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : e.target.valueAsNumber
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Status is read-only here — every transition has its own
                dedicated, confirmed action on the plot detail page (Mark as
                harvested, Archive, etc.), each of which also updates fields
                like harvestedAt/archivedAt that this generic form does not
                know about. Create mode has no existing status to show. */}
            {mode === "edit" && defaultValues?.status && (
              <div>
                <FormLabel>Status</FormLabel>
                <div className="mt-2">
                  <StatusBadge variant={STATUS_VARIANT[defaultValues.status]}>
                    {STATUS_LABELS[defaultValues.status]}
                  </StatusBadge>
                </div>
                <FormDescription className="text-xs mt-1">
                  Use Mark as harvested, Archive, or Restore on the plot page
                  to change status.
                </FormDescription>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crop & schedule</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cropId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Crop</FormLabel>
                  <Select
                    onValueChange={handleCropChange}
                    value={field.value ?? NO_CROP}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a crop" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CROP}>None (empty plot)</SelectItem>
                      {crops.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
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
              name="facultyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Faculty adviser</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === NO_FACULTY ? null : v)
                    }
                    value={field.value ?? NO_FACULTY}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a faculty adviser" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_FACULTY}>None (no adviser)</SelectItem>
                      {faculty.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.firstName} {f.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    The faculty member responsible for advising this plot.
                    Students can only be assigned once an adviser is set.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentStageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current stage</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === NO_CROP ? null : v)
                    }
                    value={field.value ?? NO_CROP}
                    disabled={!selectedCrop}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedCrop ? "Select a stage" : "Select a crop first"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CROP}>—</SelectItem>
                      {stageOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
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
              name="plantingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Planting date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ""}
                      onChange={(e) => handlePlantingDateChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expectedHarvest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected harvest</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  {selectedCrop && (
                    <FormDescription className="text-xs">
                      Auto-calculated from planting date + {selectedCrop.daysToHarvest} days. Editable.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : mode === "create" ? "Create plot" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (mode === "edit") {
                router.back();
              } else {
                router.push("/dashboard/plots");
              }
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
