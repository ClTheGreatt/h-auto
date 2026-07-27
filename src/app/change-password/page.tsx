import { SessionProvider } from "next-auth/react";
import { Sprout } from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { FirstLoginPasswordForm } from "@/components/profile/first-login-password-form";

// Deliberately outside the dashboard route group — no sidebar, no nav.
// A self-service page: not gated by middleware, reachable any time a user
// wants to change their password (e.g. from the dashboard reminder banner).
export default async function ChangePasswordPage() {
  const session = await requireAuth();

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
            <Sprout className="w-6 h-6" />
            <span className="text-lg font-semibold">H-Auto</span>
          </div>

          <p className="text-sm text-center text-muted-foreground">
            Change your password below. If this is your first login, we
            recommend changing your temporary password now for security.
          </p>

          <FirstLoginPasswordForm />
        </div>
      </div>
    </SessionProvider>
  );
}
