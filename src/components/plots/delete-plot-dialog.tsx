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
import { archivePlot } from "@/actions/plots";

export function DeletePlotDialog({
  plotId,
  plotName,
  activeAssignmentCount,
  trigger,
}: {
  plotId: string;
  plotName: string;
  activeAssignmentCount: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    const result = await archivePlot(plotId);
    setArchiving(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Plot archived");
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this plot?</AlertDialogTitle>
          <AlertDialogDescription>
            This will archive <strong>{plotName}</strong> and preserve all
            historical data. It will no longer appear in active lists but can
            be restored by an administrator.
            {activeAssignmentCount > 0 && (
              <>
                {" "}
                This will also end {activeAssignmentCount} active assignment
                {activeAssignmentCount === 1 ? "" : "s"}.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleArchive();
            }}
            disabled={archiving}
            className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
          >
            {archiving ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
