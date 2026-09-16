"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import { ChevronDown, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  removeStageReferenceImage,
  uploadStageReferenceImage,
} from "@/actions/crops";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  STAGE_REFERENCE_IMAGE_ACCEPT,
  STAGE_REFERENCE_IMAGE_SIZE_COPY,
} from "@/lib/crops/stage-reference-constants";
import { stageReferenceAlt } from "@/lib/crops/stage-reference";
import type { CropFormValues } from "@/lib/validations/crop";

type StageReferenceGuideFieldsProps = {
  control: Control<CropFormValues>;
  index: number;
  cropId?: string;
  stageId?: string;
  imageUrl?: string;
  onImageChange: (stageId: string, imageUrl?: string) => void;
  onMediaPendingChange: (stageId: string, pending: boolean) => void;
};

export function StageReferenceGuideFields({
  control,
  index,
  cropId,
  stageId,
  imageUrl,
  onImageChange,
  onMediaPendingChange,
}: StageReferenceGuideFieldsProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropName = useWatch({ control, name: "name" });
  const stageName = useWatch({ control, name: `stages.${index}.name` });
  const [expectedAppearance, observableSigns, facultyGuidance] = useWatch({
    control,
    name: [
      `stages.${index}.expectedAppearance`,
      `stages.${index}.observableSigns`,
      `stages.${index}.facultyGuidance`,
    ],
  });
  const hasContent = Boolean(
    imageUrl ||
      expectedAppearance?.trim() ||
      observableSigns?.some((sign) => sign.trim()) ||
      facultyGuidance?.trim()
  );
  const imageFailed = Boolean(imageUrl && failedImageUrl === imageUrl);

  async function handleFile(file?: File) {
    if (!file || !cropId || !stageId) return;
    setPending(true);
    onMediaPendingChange(stageId, true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadStageReferenceImage(cropId, stageId, formData);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Image upload failed");
        return;
      }
      onImageChange(stageId, result.url);
      setFailedImageUrl(undefined);
      toast.success(imageUrl ? "Reference image replaced" : "Reference image uploaded");
      if (result.cleanupWarning) toast.warning(result.cleanupWarning);
    } catch {
      toast.error("Image upload failed. Please try again.");
    } finally {
      setPending(false);
      onMediaPendingChange(stageId, false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!cropId || !stageId) return;
    setPending(true);
    onMediaPendingChange(stageId, true);
    try {
      const result = await removeStageReferenceImage(cropId, stageId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onImageChange(stageId, undefined);
      setFailedImageUrl(undefined);
      toast.success("Reference image removed");
      if (result.cleanupWarning) toast.warning(result.cleanupWarning);
    } catch {
      toast.error("Could not remove the image. Please try again.");
    } finally {
      setPending(false);
      onMediaPendingChange(stageId, false);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border bg-muted/30">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between px-4 py-3 h-auto"
          >
            <span className="text-left">
              <span className="block font-medium">Stage Reference Guide (optional)</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {hasContent ? "Guide added" : "Add visual and written reference details"}
              </span>
            </span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-5 border-t px-4 py-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Reference image</div>
            {stageId && cropId ? (
              <div className="space-y-3">
                {imageUrl ? (
                  <div className="max-w-sm space-y-2">
                    {!imageFailed ? (
                      <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-background">
                        <Image
                          src={imageUrl}
                          alt={stageReferenceAlt(cropName || "Crop", stageName || "Growth")}
                          fill
                          sizes="(max-width: 768px) 100vw, 384px"
                          className="object-contain"
                          onError={() => setFailedImageUrl(imageUrl)}
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center rounded-md border bg-background px-4 text-center text-sm text-muted-foreground">
                        Reference image is unavailable. The written guide is still available.
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Reference image</p>
                  </div>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={STAGE_REFERENCE_IMAGE_ACCEPT}
                  className="sr-only"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-2 size-4" />
                    {pending ? "Working..." : imageUrl ? "Replace" : "Upload reference image"}
                  </Button>
                  {imageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={handleRemove}
                      className="text-danger-text hover:text-danger-text"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, or WebP. {STAGE_REFERENCE_IMAGE_SIZE_COPY}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Save this crop first to upload a reference image.
              </p>
            )}
          </div>

          <FormField
            control={control}
            name={`stages.${index}.expectedAppearance`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected appearance</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    rows={4}
                    className="resize-y"
                    placeholder="Describe the plant's typical appearance during this stage"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`stages.${index}.observableSigns`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observable signs</FormLabel>
                <FormControl>
                  <Textarea
                    value={(field.value ?? []).join("\n")}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    onChange={(event) => field.onChange(event.target.value.split(/\r?\n/))}
                    rows={4}
                    className="resize-y"
                    placeholder={"First visible sign\nAnother observable sign"}
                  />
                </FormControl>
                <FormDescription>Enter one observable sign per line (up to 10).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`stages.${index}.facultyGuidance`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Faculty guidance</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    rows={4}
                    className="resize-y"
                    placeholder="Add teaching or observation guidance for this stage"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="text-xs text-muted-foreground">
            Use this guide as a visual reference. Actual plant appearance may vary by
            variety and growing conditions.
          </p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
