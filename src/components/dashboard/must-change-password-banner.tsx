"use client";

import { useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

function dismissKey(userId: string): string {
  return `password-reminder-dismissed-${userId}`;
}

// Tiny external store over sessionStorage so dismiss state can be read via
// useSyncExternalStore (avoids the set-state-in-effect lint rule) while
// still updating this tab's UI immediately when the button is clicked.
// sessionStorage (not localStorage) so the dismissal clears when the
// browser tab/session ends — a per-session nudge, not a permanent opt-out.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isDismissed(userId: string | undefined): boolean {
  if (!userId) return true;
  return sessionStorage.getItem(dismissKey(userId)) === "true";
}

function dismiss(userId: string) {
  sessionStorage.setItem(dismissKey(userId), "true");
  listeners.forEach((l) => l());
}

export function MustChangePasswordBanner() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const mustChangePassword = session?.user?.mustChangePassword ?? false;

  const dismissed = useSyncExternalStore(
    subscribe,
    () => isDismissed(userId),
    () => true // server snapshot: hidden until the client hydrates
  );

  if (!mustChangePassword || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-300">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="truncate">
          You&apos;re still using your temporary password. Change it now for
          better security.
        </span>
        <Link
          href="/change-password"
          className="font-medium underline underline-offset-2 hover:no-underline whitespace-nowrap"
        >
          Change password
        </Link>
      </div>
      <button
        type="button"
        onClick={() => userId && dismiss(userId)}
        aria-label="Dismiss"
        className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
