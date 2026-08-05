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
import { reactivateUser } from "@/actions/users";
import { stripInactivePrefix } from "@/lib/users/inactive-prefix";

export function ReactivateUserDialog({
  userId,
  userName,
  userEmail,
  trigger,
}: {
  userId: string;
  userName: string;
  // Stored value — may carry the inactive_<timestamp>_ prefix. Stripped
  // here only for display; reactivateUser() re-derives it server-side.
  userEmail: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const restoredEmail = stripInactivePrefix(userEmail);

  async function handleConfirm() {
    setSubmitting(true);
    const result = await reactivateUser(userId);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("User reactivated", {
      description: `${userName} can sign in again.`,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate user?</AlertDialogTitle>
          <AlertDialogDescription>
            This restores <strong>{userName}</strong>&apos;s account access
            and returns their email address to{" "}
            <strong>{restoredEmail}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? "Reactivating..." : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
