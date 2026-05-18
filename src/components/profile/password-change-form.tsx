"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock } from "lucide-react";
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

export function PasswordChangeForm() {
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
    setSubmitting(false);

    if (mapServerErrorsToForm(form, result ?? {})) {
      toast.error(result?.error ?? "Please fix the errors below");
      return;
    }

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Password changed successfully");
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-500" />
          Change password
        </CardTitle>
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
                    Current password <RequiredMark />
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
                    Minimum 6 characters. Use something different from your
                    temporary password.
                  </FormDescription>
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

            <Button type="submit" disabled={submitting}>
              {submitting ? "Changing..." : "Change password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}