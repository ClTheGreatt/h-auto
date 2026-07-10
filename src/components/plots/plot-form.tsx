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
import { plotSchema, type PlotFormValues } from "@/lib/validations/plot";
import { createPlot, updatePlot } from "@/actions/plots";

type CropOption = {
  id: string;
  name: string;
  daysToHarvest: number;
  stages: Array<{ id: string; name: string; orderIndex: number }>;
};

type PlotFormProps = {
  mode: "create" | "edit";
  plotId?: string;
  crops: CropOption[];
  defaultValues?: Partial<PlotFormValues>;
};

const NO_CROP = "__none__";

export function PlotForm({ mode, plotId, crops, defaultValues }: PlotFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      location: defaultValues?.location ?? "",
      sizeSqm: defaultValues?.sizeSqm ?? null,
      cropId: defaultValues?.cropId ?? null,
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
    const result =
      mode === "create"
        ? await createPlot(values)
        : await updatePlot(plotId!, values);

    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Plot created" : "Plot updated");
    router.push("/dashboard/plots");
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
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status <RequiredMark /></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PREPARING">Preparing</SelectItem>
                      <SelectItem value="PLANTED">Planted</SelectItem>
                      <SelectItem value="GROWING">Growing</SelectItem>
                      <SelectItem value="READY_FOR_HARVEST">Ready for harvest</SelectItem>
                      <SelectItem value="HARVESTED">Harvested</SelectItem>
                      <SelectItem value="FALLOW">Fallow</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            onClick={() => router.push("/dashboard/plots")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
