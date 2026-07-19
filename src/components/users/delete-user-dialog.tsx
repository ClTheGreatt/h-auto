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
import { deactivateUser } from "@/actions/users";

export function DeleteUserDialog({
  userId,
  userName,
  trigger,
}: {
  userId: string;
  userName: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleDeactivate() {
    setDeactivating(true);
    const result = await deactivateUser(userId);
    setDeactivating(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    // Show different toast depending on outcome
    if (result?.mode === "deactivated") {
      toast.success("User deactivated", {
        description: result.message,
      });
    } else {
      toast.success("User deactivated");
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate <strong>{userName}</strong>&apos;s account.
            They will lose access immediately, but their historical data
            (plots, growth logs, alerts, assignments) is preserved. You can
            reactivate them later by editing their profile.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDeactivate();
            }}
            disabled={deactivating}
            className="bg-red-600 hover:bg-red-700"
          >
            {deactivating ? "Processing..." : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
