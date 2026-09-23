"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
import { cropSchema, type CropFormValues } from "@/lib/validations/crop";
import { createCrop, updateCrop } from "@/actions/crops";
import { CROP_PRESETS, type CropPreset } from "@/lib/crops/presets";
import {
  getPresetLoadValues,
  NONE_PRESET_ID,
  PARAMETER_BASIS,
  resolvePresetSelection,
  showsPresetQuickStart,
  type ThresholdField,
} from "@/lib/crops/preset-provenance";
import { StageReferenceGuideFields } from "@/components/crops/stage-reference-guide-fields";
import { PresetProvenancePanel } from "@/components/crops/preset-provenance-panel";

type CropFormProps = {
  mode: "create" | "edit";
  cropId?: string;
  defaultValues?: Partial<CropFormValues>;
  // Admin-promoted crops (Crop.isPreset = true), reshaped to the same
  // CropPreset shape as the 9 built-ins. Only relevant in create mode.
  customPresets?: CropPreset[];
  // Plots currently on one of this crop's stages (edit mode only) — gates
  // the save confirmation below. 0/undefined skips the dialog entirely.
  plotsInUseCount?: number;
  stageReferenceImages?: Record<string, string>;
};

const emptyStage = {
  name: "",
  orderIndex: 0,
  durationDays: 7,
  description: "",
  expectedAppearance: "",
  observableSigns: [],
  facultyGuidance: "",
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

export function CropForm({
  mode,
  cropId,
  defaultValues,
  customPresets = [],
  plotsInUseCount = 0,
  stageReferenceImages = {},
}: CropFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<CropPreset | null>(null);
  const [imageUrls, setImageUrls] = useState(stageReferenceImages);
  const [mediaPendingStageIds, setMediaPendingStageIds] = useState<Set<string>>(
    () => new Set()
  );
  const hasMediaPending = mediaPendingStageIds.size > 0;
  const needsSaveConfirm = mode === "edit" && plotsInUseCount > 0;
  const showPresetBasis =
    selectedPreset?.provenance?.kind === "REFERENCE_REVIEWED";

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

  const { fields, append, remove, replace, move } = useFieldArray({
    control: form.control,
    name: "stages",
  });

  function handlePresetSelect(presetId: string) {
    if (presetId === NONE_PRESET_ID) {
      setSelectedPreset(null);
      form.setValue("name", "");
      form.setValue("daysToHarvest", 30);
      form.setValue("description", "");
      form.setValue("cultivationGuide", "");
      replace([emptyStage]);
      toast.info("Cleared. Enter values manually.");
      return;
    }

    const preset = resolvePresetSelection(presetId, CROP_PRESETS, customPresets);
    if (!preset) return;
    setSelectedPreset(preset);

    const loadedValues = getPresetLoadValues(preset);

    // Don't set variety — it varies per seed brand, user's own input.
    form.setValue("name", loadedValues.name);
    form.setValue("daysToHarvest", loadedValues.daysToHarvest);
    form.setValue("description", loadedValues.description);
    form.setValue("cultivationGuide", loadedValues.cultivationGuide);

    replace(loadedValues.stages);

    toast.success(`Loaded ${preset.displayName} preset. Review and edit as needed.`);
  }

  async function onSubmit(values: CropFormValues) {
    if (hasMediaPending) {
      toast.info("Finish the image operation before saving the crop.");
      return;
    }
    setSubmitting(true);

    try {
      const result =
        mode === "create"
          ? await createCrop(values)
          : await updateCrop(cropId!, values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Crop created" : "Crop updated");
      if ("cleanupWarning" in result && result.cleanupWarning) {
        toast.warning(result.cleanupWarning);
      }
      router.push(
        mode === "create" && "cropId" in result && result.cropId
          ? `/dashboard/crops/${result.cropId}/edit`
          : "/dashboard/crops"
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {showsPresetQuickStart(mode) && (
          <Card>
            <CardHeader>
              <CardTitle>Quick start (optional)</CardTitle>
              <CardDescription>
                Select a common vegetable to auto-fill configurable starting
                values. You can still edit any field before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select onValueChange={handlePresetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PRESET_ID} className="italic text-muted-foreground">
                    — None (manual entry) —
                  </SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Built-in</SelectLabel>
                    {CROP_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {customPresets.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Custom</SelectLabel>
                        {customPresets.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.displayName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              <PresetProvenancePanel preset={selectedPreset} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Crop information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
              <h2 className="text-lg font-semibold text-foreground">Growth stages</h2>
              <p className="text-sm text-muted-foreground">
                Define each stage and its configurable monitoring thresholds.
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
                  <div className="flex items-center gap-1">
                    {/* Move controls — disabled (not hidden) at the ends, so
                        the control set stays visually stable as the admin
                        works through the list. Grouped and gapped away from
                        Remove below so a reorder tap can't land on the
                        destructive action. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label="Move stage up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label="Move stage down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(
                          stage.dbId && mediaPendingStageIds.has(stage.dbId)
                        )}
                        title={
                          stage.dbId && mediaPendingStageIds.has(stage.dbId)
                            ? "Finish the image operation before removing this stage."
                            : undefined
                        }
                        onClick={() => remove(index)}
                        className="text-danger-text hover:text-danger-text ml-2"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Carries the existing stage's DB id through submission
                      so updateCrop can update it in place instead of
                      deleting and recreating it. Not rendered as a visible
                      field — nothing for the admin to see or edit here. */}
                  <input type="hidden" {...form.register(`stages.${index}.dbId`)} />
                  <div>
                    <h3 className="text-sm font-medium mb-3">Stage information</h3>
                    <StageBasicFields control={form.control} index={index} />
                  </div>
                  <Separator />
                  <StageReferenceGuideFields
                    control={form.control}
                    index={index}
                    cropId={cropId}
                    stageId={stage.dbId}
                    imageUrl={stage.dbId ? imageUrls[stage.dbId] : undefined}
                    onImageChange={(stageId, imageUrl) =>
                      setImageUrls((current) => {
                        const next = { ...current };
                        if (imageUrl) next[stageId] = imageUrl;
                        else delete next[stageId];
                        return next;
                      })
                    }
                    onMediaPendingChange={(stageId, pending) =>
                      setMediaPendingStageIds((current) => {
                        const next = new Set(current);
                        if (pending) next.add(stageId);
                        else next.delete(stageId);
                        return next;
                      })
                    }
                  />
                  <Separator />
                  <StageThresholdFields
                    control={form.control}
                    index={index}
                    showPresetBasis={showPresetBasis}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sticky bottom-0 bg-muted py-4 border-t">
          {needsSaveConfirm ? (
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={submitting || hasMediaPending}>
                  {submitting ? "Saving..." : "Save changes"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save changes to this crop?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {plotsInUseCount === 1
                      ? "1 plot is currently using a stage from this crop."
                      : `${plotsInUseCount} plots are currently using a stage from this crop.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                  {/* Default styling, not solid red — saving is no longer
                      destructive to in-use stages (updateCrop now updates
                      them in place and blocks removing one that's still in
                      use). This is an awareness prompt, not a danger
                      confirm. */}
                  <AlertDialogAction
                    disabled={submitting || hasMediaPending}
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmOpen(false);
                      form.handleSubmit(onSubmit)();
                    }}
                  >
                    {submitting ? "Saving..." : "Save changes"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button type="submit" disabled={submitting || hasMediaPending}>
              {submitting ? "Saving..." : mode === "create" ? "Create crop" : "Save changes"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/crops")}
          >
            Cancel
          </Button>
          {hasMediaPending ? (
            <p className="text-sm text-muted-foreground">
              Finish the image operation before saving the crop.
            </p>
          ) : null}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
  showPresetBasis,
}: {
  control: Control<CropFormValues>;
  index: number;
  showPresetBasis: boolean;
}) {
  return (
    <div className="space-y-4">
      {showPresetBasis ? (
        <p className="text-xs text-muted-foreground">
          Initial preset settings — these labels describe the loaded starting
          profile; all fields remain editable.
        </p>
      ) : null}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Environmental thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ThresholdPair
            control={control}
            index={index}
            field="SoilMoisture"
            label="Soil moisture (%)"
            showPresetBasis={showPresetBasis}
          />
          <ThresholdPair
            control={control}
            index={index}
            field="Temperature"
            label="Temperature (°C)"
            showPresetBasis={showPresetBasis}
          />
          <ThresholdPair
            control={control}
            index={index}
            field="Humidity"
            label="Humidity (%)"
            showPresetBasis={showPresetBasis}
          />
          <ThresholdPair
            control={control}
            index={index}
            field="LightIntensity"
            label="Light intensity (lux)"
            showPresetBasis={showPresetBasis}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Soil nutrients (mg/kg)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ThresholdPair
            control={control}
            index={index}
            field="Nitrogen"
            label="Nitrogen (N)"
            showPresetBasis={showPresetBasis}
          />
          <ThresholdPair
            control={control}
            index={index}
            field="Phosphorus"
            label="Phosphorus (P)"
            showPresetBasis={showPresetBasis}
          />
          <ThresholdPair
            control={control}
            index={index}
            field="Potassium"
            label="Potassium (K)"
            showPresetBasis={showPresetBasis}
          />
        </div>
      </div>
    </div>
  );
}

function ThresholdPair({
  control,
  index,
  field,
  label,
  showPresetBasis,
}: {
  control: Control<CropFormValues>;
  index: number;
  field: ThresholdField;
  label: string;
  showPresetBasis: boolean;
}) {
  const minName = `stages.${index}.min${field}` as const;
  const maxName = `stages.${index}.max${field}` as const;

  return (
    <div className="border rounded-md p-3 bg-muted">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {showPresetBasis ? (
          <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
            {PARAMETER_BASIS[field].label}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 items-start">
        <FormField
          control={control}
          name={minName}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Min</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  className="h-8"
                  {...f}
                  onChange={(e) => f.onChange(e.target.valueAsNumber)}
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
              <FormLabel className="text-xs text-muted-foreground">Max</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  className="h-8"
                  {...f}
                  onChange={(e) => f.onChange(e.target.valueAsNumber)}
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
