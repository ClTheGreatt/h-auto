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
import { deleteGrowthLog } from "@/actions/growth";

export function DeleteLogDialog({
  logId,
  trigger,
}: {
  logId: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteGrowthLog(logId);
    setDeleting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Log entry deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this log entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the log entry and all its photos. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          {/* Intentionally solid red, not variant="destructive" — that variant
              is a 10%-opacity ghost tint meant for inline/icon buttons and
              would read weaker than the outline Cancel button beside it.
              dark:bg-red-600 keeps the same vivid red on dark backgrounds;
              dark:hover:bg-red-500 brightens on hover instead of darkening,
              since darkening further would lose contrast against a dark
              popover. Do not "fix" this into variant="destructive". */}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
          >
            {deleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}