"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { harvestPlot } from "@/actions/plots";

export function HarvestPlotDialog({
  plotId,
  plotName,
  trigger,
}: {
  plotId: string;
  plotName: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [harvesting, setHarvesting] = useState(false);

  async function handleHarvest() {
    setHarvesting(true);
    const result = await harvestPlot(plotId);
    setHarvesting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Plot marked as harvested");
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark plot as harvested?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks <strong>{plotName}</strong> as harvested. Sensor
            ingest and new growth logs will be blocked until it&apos;s
            unmarked. You can undo this anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={harvesting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleHarvest();
            }}
            disabled={harvesting}
          >
            {harvesting ? "Marking..." : "Mark as harvested"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
