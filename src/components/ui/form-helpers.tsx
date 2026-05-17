"use client";

import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { AlertCircle } from "lucide-react";

/** Red asterisk for required fields. Consistent across all forms. */
export function RequiredMark() {
  return (
    <span className="text-red-500 ml-0.5" aria-label="required">
      *
    </span>
  );
}

/**
 * Form-level error banner. Shows only AFTER first submit attempt
 * and only when there are field errors. Auto-counts errors.
 */
export function FormErrorSummary<T extends FieldValues>({
  form,
}: {
  form: UseFormReturn<T>;
}) {
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;
  const wasSubmitted = form.formState.isSubmitted;

  if (!wasSubmitted || errorCount === 0) return null;

  return (
    <div className="flex gap-3 p-3 rounded-md bg-red-50 border border-red-200">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm flex-1">
        <div className="font-medium text-red-900">
          Please fix {errorCount} {errorCount === 1 ? "error" : "errors"} below
        </div>
        <p className="text-red-800 text-xs mt-1">
          Highlighted fields need your attention.
        </p>
      </div>
    </div>
  );
}

/**
 * Maps server action's Zod `fieldErrors` back to react-hook-form errors.
 * Returns true if at least one field error was mapped.
 *
 * Usage:
 *   const result = await createUser(values);
 *   if (mapServerErrorsToForm(form, result)) {
 *     toast.error(result.error ?? "Please fix the errors below");
 *     return;
 *   }
 */
type ServerResult = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function mapServerErrorsToForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  result: ServerResult
): boolean {
  if (!result.fieldErrors) return false;

  let mapped = false;
  for (const [field, messages] of Object.entries(result.fieldErrors)) {
    const message = messages?.[0];
    if (message) {
      form.setError(field as Path<T>, { message });
      mapped = true;
    }
  }
  return mapped;
}