"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  FormErrorSummary,
  RequiredMark,
  mapServerErrorsToForm,
} from "@/components/ui/form-helpers";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations/profile";
import { changePassword } from "@/actions/profile";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";

// Reuses the same changePassword server action as the profile page's
// PasswordChangeForm. changePassword always bumps tokenVersion, which would
// otherwise invalidate the *current* session too (auth.ts's jwt callback
// rejects a stale tokenVersion on the very next request) — so after a
// successful change we call useSession().update(), which round-trips
// through the jwt callback's `trigger === "update"` branch and adopts the
// fresh tokenVersion/mustChangePassword as the token's new baseline,
// keeping this session valid instead of forcing a re-login.
export function FirstLoginPasswordForm() {
  const router = useRouter();
  const { update } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setSubmitting(true);
    const result = await changePassword(values);

    if (mapServerErrorsToForm(form, result ?? {})) {
      setSubmitting(false);
      toast.error(result?.error ?? "Please fix the errors below");
      return;
    }

    if (result?.error) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    toast.success("Password changed");
    await update();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change your password</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormErrorSummary form={form} />

            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Current (temporary) password <RequiredMark />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    New password <RequiredMark />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Minimum 8 characters, with at least 1 uppercase letter, 1
                    lowercase letter, 1 number, and 1 symbol.
                  </FormDescription>
                  <PasswordStrengthIndicator password={field.value ?? ""} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Confirm new password <RequiredMark />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Changing..." : "Change password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
