"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { togglePreset } from "@/actions/crops";

export function PresetToggle({
  cropId,
  initialValue,
}: {
  cropId: string;
  initialValue: boolean;
}) {
  const router = useRouter();
  const [isPreset, setIsPreset] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  async function handleToggle() {
    setSubmitting(true);
    const nextValue = !isPreset;
    const result = await togglePreset(cropId, nextValue);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    setIsPreset(nextValue);
    toast.success(
      nextValue
        ? "Added to the Quick start dropdown"
        : "Removed from the Quick start dropdown"
    );
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={isPreset ? "default" : "outline"}
      size="sm"
      disabled={submitting}
      onClick={handleToggle}
    >
      <Star className={isPreset ? "w-4 h-4 mr-2 fill-current" : "w-4 h-4 mr-2"} />
      {isPreset ? "Saved as preset" : "Save as preset"}
    </Button>
  );
}
