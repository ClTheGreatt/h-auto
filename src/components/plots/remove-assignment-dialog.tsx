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
import { removeAssignment } from "@/actions/assignments";

export function RemoveAssignmentDialog({
  assignmentId,
  studentName,
  trigger,
}: {
  assignmentId: string;
  studentName: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    const result = await removeAssignment(assignmentId);
    setRemoving(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assignment removed");
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {/* stopPropagation here (and again on AlertDialogContent below, since
          Radix portals that outside the DOM tree but React still bubbles
          through the component tree) keeps a trigger click from also
          reaching a clickable ancestor that navigates via an onClick
          handler — a <TableRow onClick={() => router.push(...)}>, say.
          Both current callers wrap this in a plain <div>, so today it stops
          nothing; it is cheap insurance if a caller ever nests it inside
          such a row.

          It does NOT stop a real <a href> from navigating. An anchor's
          navigation is the event's default action, not a listener, and only
          preventDefault() cancels a default action. Worse, stopping
          propagation also keeps Next's own Link handler from running, so
          its internal preventDefault() never fires either and the browser
          falls through to a full page load. Do not nest this component
          inside a Link — link something else in the card instead, as
          assignments/page.tsx does with the plot badge. */}
      <span onClick={(e) => e.stopPropagation()} className="contents">
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      </span>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this assignment?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <strong>{studentName}</strong> from this plot.
            Their historical growth logs and readings are preserved, but they
            will no longer be able to log activity here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
          {/* Intentionally solid red, not variant="destructive" — see
              delete-log-dialog.tsx for why that variant (a 10%-opacity
              ghost tint) reads too weak next to an outline Cancel button.
              Do not "fix" this into variant="destructive". */}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRemove();
            }}
            disabled={removing}
            className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
          >
            {removing ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
