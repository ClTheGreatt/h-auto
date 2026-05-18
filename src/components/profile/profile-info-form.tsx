"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/lib/validations/profile";
import { updateProfile } from "@/actions/profile";

type Props = {
  defaultValues: UpdateProfileInput;
};

export function ProfileInfoForm({ defaultValues }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    mode: "onBlur",
    defaultValues,
  });

  async function onSubmit(values: UpdateProfileInput) {
    setSubmitting(true);
    const result = await updateProfile(values);
    setSubmitting(false);

    if (mapServerErrorsToForm(form, result ?? {})) {
      toast.error(result?.error ?? "Please fix the errors below");
      return;
    }

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Profile updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormErrorSummary form={form} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      First name <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Last name <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone number</FormLabel>
                  <FormControl>
                    <Input placeholder="+639171234567" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Format: +63 followed by 10 digits
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}