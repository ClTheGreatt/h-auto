"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RequiredMark } from "@/components/ui/form-helpers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cropSchema, type CropFormValues } from "@/lib/validations/crop";
import { createCrop, updateCrop } from "@/actions/crops";
import { CROP_PRESETS } from "@/lib/crops/presets";

type CropFormProps = {
  mode: "create" | "edit";
  cropId?: string;
  defaultValues?: Partial<CropFormValues>;
};

const NONE_PRESET = "__none__";

const emptyStage = {
  name: "",
  orderIndex: 0,
  durationDays: 7,
  description: "",
  minSoilMoisture: 60,
  maxSoilMoisture: 80,
  minTemperature: 20,
  maxTemperature: 28,
  minHumidity: 60,
  maxHumidity: 80,
  minLightIntensity: 5000,
  maxLightIntensity: 15000,
  minNitrogen: 50,
  maxNitrogen: 120,
  minPhosphorus: 30,
  maxPhosphorus: 60,
  minPotassium: 50,
  maxPotassium: 150,
};

export function CropForm({ mode, cropId, defaultValues }: CropFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CropFormValues>({
    resolver: zodResolver(cropSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      variety: defaultValues?.variety ?? "",
      description: defaultValues?.description ?? "",
      daysToHarvest: defaultValues?.daysToHarvest ?? 30,
      cultivationGuide: defaultValues?.cultivationGuide ?? "",
      stages: defaultValues?.stages ?? [emptyStage],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "stages",
  });

  function handlePresetSelect(presetId: string) {
    if (presetId === NONE_PRESET) {
      form.setValue("name", "");
      form.setValue("daysToHarvest", 30);
      form.setValue("description", "");
      form.setValue("cultivationGuide", "");
      replace([emptyStage]);
      toast.info("Cleared. Enter values manually.");
      return;
    }

    const preset = CROP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // Don't set variety — it varies per seed brand, user's own input.
    form.setValue("name", preset.name);
    form.setValue("daysToHarvest", preset.daysToHarvest);
    form.setValue("description", preset.description);
    form.setValue("cultivationGuide", preset.cultivationGuide);

    replace(
      preset.stages.map((s, i) => ({
        ...s,
        orderIndex: i,
      }))
    );

    toast.success(`Loaded ${preset.displayName} preset. Review and edit as needed.`);
  }

  async function onSubmit(values: CropFormValues) {
    setSubmitting(true);
    const result =
      mode === "create"
        ? await createCrop(values)
        : await updateCrop(cropId!, values);

    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Crop created" : "Crop updated");
    router.push("/dashboard/crops");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {mode === "create" && (
          <Card>
            <CardHeader>
              <CardTitle>Quick start (optional)</CardTitle>
              <CardDescription>
                Select a common vegetable to auto-fill recommended values. You
                can still edit any field before saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select onValueChange={handlePresetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="w-(--radix-select-trigger-width)"
                >
                  <SelectItem value={NONE_PRESET} className="italic text-muted-foreground">
                    — None (manual entry) —
                  </SelectItem>
                  {CROP_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Crop information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <RequiredMark /></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Tomato" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="variety"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variety</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Diamante Max F1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="daysToHarvest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days to harvest <RequiredMark /></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      className="resize-none"
                      placeholder="Short description of this crop"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cultivationGuide"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Cultivation guide</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      className="resize-none"
                      placeholder="Planting, watering, fertilization, and harvest instructions"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Growth stages</h2>
              <p className="text-sm text-gray-500">
                Define each stage and the ideal thresholds for that stage.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...emptyStage, orderIndex: fields.length })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add stage
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((stage, index) => (
              <Card key={stage.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Stage {index + 1}</CardTitle>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <StageBasicFields control={form.control} index={index} />
                  <Separator />
                  <StageThresholdFields control={form.control} index={index} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex gap-3 sticky bottom-0 bg-gray-50 py-4 border-t">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : mode === "create" ? "Create crop" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/crops")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

function StageBasicFields({
  control,
  index,
}: {
  control: Control<CropFormValues>;
  index: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={control}
        name={`stages.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Stage name <RequiredMark /></FormLabel>
            <FormControl>
              <Input placeholder="e.g. Germination" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`stages.${index}.durationDays`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Duration (days) <RequiredMark /></FormLabel>
            <FormControl>
              <Input
                type="number"
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`stages.${index}.description`}
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input placeholder="What happens during this stage?" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function StageThresholdFields({
  control,
  index,
}: {
  control: Control<CropFormValues>;
  index: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Environmental thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ThresholdPair control={control} index={index} field="SoilMoisture" label="Soil moisture (%)" />
          <ThresholdPair control={control} index={index} field="Temperature" label="Temperature (°C)" />
          <ThresholdPair control={control} index={index} field="Humidity" label="Humidity (%)" />
          <ThresholdPair control={control} index={index} field="LightIntensity" label="Light intensity (lux)" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Soil nutrients (mg/kg)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ThresholdPair control={control} index={index} field="Nitrogen" label="Nitrogen (N)" />
          <ThresholdPair control={control} index={index} field="Phosphorus" label="Phosphorus (P)" />
          <ThresholdPair control={control} index={index} field="Potassium" label="Potassium (K)" />
        </div>
      </div>
    </div>
  );
}

type ThresholdField =
  | "SoilMoisture"
  | "Temperature"
  | "Humidity"
  | "LightIntensity"
  | "Nitrogen"
  | "Phosphorus"
  | "Potassium";

function ThresholdPair({
  control,
  index,
  field,
  label,
}: {
  control: Control<CropFormValues>;
  index: number;
  field: ThresholdField;
  label: string;
}) {
  const minName = `stages.${index}.min${field}` as const;
  const maxName = `stages.${index}.max${field}` as const;

  return (
    <div className="border rounded-md p-3 bg-gray-50">
      <div className="text-xs font-medium text-gray-600 mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <FormField
          control={control}
          name={minName}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="text-xs text-gray-500">Min</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  className="h-8"
                  {...f}
                  onChange={(e) => f.onChange(e.target.valueAsNumber || 0)}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={maxName}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="text-xs text-gray-500">Max</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  className="h-8"
                  {...f}
                  onChange={(e) => f.onChange(e.target.valueAsNumber || 0)}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}