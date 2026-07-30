"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveAlert } from "@/actions/alerts";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ResolveAlertButton({
  alertId,
  className,
}: {
  alertId: string;
  className?: string;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current || isPending) return;
    setOpen(nextOpen);
  }

  function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    startTransition(async () => {
      try {
        const result = await resolveAlert(alertId);
        if (!result?.success) {
          toast.error("Failed to resolve alert");
          return;
        }

        toast.success("Alert resolved");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to resolve alert");
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("shrink-0", className)}
        >
          Resolve
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resolve this alert?</AlertDialogTitle>
          <AlertDialogDescription>
            This will close the alert in H-Auto. It does not verify that the
            sensor condition has returned to normal. If the condition
            continues, a later reading may create a new alert.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Resolving..." : "Resolve alert"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
