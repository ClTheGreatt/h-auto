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
import { unharvestPlot } from "@/actions/plots";

export function UnharvestPlotDialog({
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
  const [unharvesting, setUnharvesting] = useState(false);

  async function handleUnharvest() {
    setUnharvesting(true);
    const result = await unharvestPlot(plotId);
    setUnharvesting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Harvest unmarked");
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unmark harvest?</AlertDialogTitle>
          <AlertDialogDescription>
            This returns <strong>{plotName}</strong> to Growing status and
            re-enables sensor ingest and growth logs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unharvesting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleUnharvest();
            }}
            disabled={unharvesting}
          >
            {unharvesting ? "Unmarking..." : "Unmark"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
