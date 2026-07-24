"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createUserSchema,
  createStudentSchema,
  createFacultySchema,
  updateUserSchema,
  YEAR_LEVELS,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  studentIdPrefixRange,
} from "@/lib/constants/user-import";
import { createUser, updateUser } from "@/actions/users";
import { isInactivePrefixed, stripInactivePrefix } from "@/lib/users/inactive-prefix";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";

const { min: STUDENT_ID_MIN, max: STUDENT_ID_MAX } = studentIdPrefixRange();

// If an existing (legacy) value isn't one of the canonical options, show it
// as an extra leading choice so editing doesn't silently blank out or force
// a change to a field the admin isn't trying to touch.
function optionsWithLegacyValue(
  canonical: readonly string[],
  currentValue: string | undefined
): string[] {
  if (currentValue && !canonical.includes(currentValue)) {
    return [currentValue, ...canonical];
  }
  return [...canonical];
}

type FormValues = z.infer<typeof updateUserSchema>;

type SimilarUser = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  role: string;
};

type UserFormProps = {
  mode: "create" | "edit";
  userId?: string;
  defaultValues?: Partial<FormValues>;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  FACULTY: "Faculty",
  STUDENT_FARMER: "Student Farmer",
};

export function UserForm({ mode, userId, defaultValues }: UserFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [similarResult, setSimilarResult] = useState<{
    key: string;
    users: SimilarUser[];
  }>({ key: "", users: [] });

  // EDIT stays lenient (updateUserSchema) so existing incomplete users can
  // still be saved. CREATE picks the strict, role-specific schema so
  // Add User/Add Faculty can't submit with missing required fields.
  const resolver: Resolver<FormValues> = (values, context, options) => {
    const schema =
      mode === "create"
        ? values.role === "STUDENT_FARMER"
          ? createStudentSchema
          : values.role === "FACULTY"
          ? createFacultySchema
          : createUserSchema
        : updateUserSchema;
    return zodResolver(schema as unknown as typeof updateUserSchema)(
      values,
      context,
      options
    );
  };

  const form = useForm<FormValues>({
    resolver,
    mode: "onBlur", // Validate when user leaves a field (modern UX)
    defaultValues: {
      firstName: defaultValues?.firstName ?? "",
      middleName: defaultValues?.middleName ?? "",
      lastName: defaultValues?.lastName ?? "",
      email: defaultValues?.email ?? "",
      phoneNumber: defaultValues?.phoneNumber ?? "",
      role: defaultValues?.role ?? "STUDENT_FARMER",
      idNumber: defaultValues?.idNumber ?? "",
      department: defaultValues?.department ?? "",
      course: defaultValues?.course ?? "",
      yearLevel: defaultValues?.yearLevel ?? "",
      section: defaultValues?.section ?? "",
      position: defaultValues?.position ?? "",
      status: defaultValues?.status ?? "ACTIVE",
      password: "",
    },
  });

  const isCreate = mode === "create";

  // Legacy DB rows may hold department/position/course values that predate
  // these canonical lists — surface them as an extra option in edit mode
  // rather than silently dropping the current value from the Select.
  const departmentOptions = optionsWithLegacyValue(DEPARTMENTS, defaultValues?.department);
  const positionOptions = optionsWithLegacyValue(FACULTY_POSITIONS, defaultValues?.position);
  const courseOptions = optionsWithLegacyValue(DEPARTMENTS, defaultValues?.course);

  const isDeactivatedWithPrefixedEmail =
    mode === "edit" &&
    !!defaultValues?.email &&
    isInactivePrefixed(defaultValues.email);
  const restoredEmailPreview = isDeactivatedWithPrefixedEmail
    ? stripInactivePrefix(defaultValues!.email!)
    : "";
  const watchedRole = useWatch({ control: form.control, name: "role" });
  const watchedFirstName = useWatch({
    control: form.control,
    name: "firstName",
  });
  const watchedLastName = useWatch({
    control: form.control,
    name: "lastName",
  });
  const similarFirstName = watchedFirstName?.trim() ?? "";
  const similarLastName = watchedLastName?.trim() ?? "";
  const similarKey =
    similarFirstName.length >= 2 && similarLastName.length >= 2
      ? `${similarFirstName}:${similarLastName}:${userId ?? ""}`
      : "";
  const similarUsers =
    similarResult.key === similarKey ? similarResult.users : [];

  // Check for similar users (debounced)
  useEffect(() => {
    if (!similarKey) return;

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          firstName: similarFirstName,
          lastName: similarLastName,
        });
        if (userId) params.set("excludeId", userId);

        const res = await fetch(`/api/users/check-similar?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSimilarResult({
            key: similarKey,
            users: data.similarUsers ?? [],
          });
        }
      } catch {
        // Silently fail - warning is non-critical
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [similarFirstName, similarLastName, similarKey, userId]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);

    if (mode === "create") {
      const result = await createUser(values as CreateUserInput);
      setSubmitting(false);

      // Try server fieldErrors first (Zod validation that escaped client)
      if (mapServerErrorsToForm(form, result)) {
        toast.error(result.error ?? "Please fix the errors below");
        return;
      }

      // Fall back to keyword mapping for friendly Prisma errors
      if (result.error) {
        const errorMsg = result.error.toLowerCase();
        if (errorMsg.includes("email")) {
          form.setError("email", { message: result.error });
        } else if (errorMsg.includes("id number")) {
          form.setError("idNumber", { message: result.error });
        } else if (errorMsg.includes("phone")) {
          form.setError("phoneNumber", { message: result.error });
        }
        toast.error(result.error);
        return;
      }

      toast.success("User created");
      if ("id" in result) {
        router.push(`/dashboard/users/${result.id}`);
      }
      router.refresh();
      return;
    }

    const result = await updateUser(userId!, values as UpdateUserInput);
    setSubmitting(false);

    // Try server fieldErrors first (Zod validation that escaped client)
    if (mapServerErrorsToForm(form, result ?? {})) {
      toast.error(result?.error ?? "Please fix the errors below");
      return;
    }

    // Fall back to keyword mapping for friendly Prisma errors
    if (result?.error) {
      const errorMsg = result.error.toLowerCase();
      if (errorMsg.includes("email")) {
        form.setError("email", { message: result.error });
      } else if (errorMsg.includes("id number")) {
        form.setError("idNumber", { message: result.error });
      } else if (errorMsg.includes("phone")) {
        form.setError("phoneNumber", { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success("User updated");
    router.back();
    // Refresh so the page we return to shows the updated data
    router.refresh();
  }

  return (
    <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormErrorSummary form={form} />

        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                  <FormLabel>First name <RequiredMark /></FormLabel>
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
                   <FormLabel>Last name <RequiredMark /></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Similar name warning */}
            {similarUsers.length > 0 && (
              <div className="flex gap-3 p-3 rounded-md bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-amber-900">
                    {similarUsers.length === 1
                      ? "A user with this name already exists"
                      : `${similarUsers.length} users with this name already exist`}
                  </div>
                  <p className="text-amber-800 text-xs mt-1">
                    Verify this is a different person before saving:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-800">
                    {similarUsers.map((u) => (
                      <li key={u.id}>
                        - {u.firstName}
                        {u.middleName ? ` ${u.middleName}` : ""}{" "}
                        {u.lastName} ({u.email}) -{" "}
                        {ROLE_LABELS[u.role] ?? u.role}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                  <FormLabel>Email <RequiredMark /></FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="e.g. juan.delacruz@bpsu.edu.ph"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Must be a BPSU email address (@bpsu.edu.ph)
                    </FormDescription>
                    {isDeactivatedWithPrefixedEmail && (
                      <p className="text-xs text-amber-600 mt-1">
                        This user was deactivated. To reactivate, change
                        Status to Active — the email will be automatically
                        restored to {restoredEmailPreview}.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedRole !== "FACULTY" && (
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Phone number
                        {isCreate && watchedRole === "STUDENT_FARMER" && (
                          <RequiredMark />
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="09171234567" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Format: 09XXXXXXXXX or +639XXXXXXXXX
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedRole === "FACULTY" ? "Employee ID" : "ID number"}
                      {isCreate &&
                        (watchedRole === "STUDENT_FARMER" ||
                          watchedRole === "FACULTY") && <RequiredMark />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          watchedRole === "FACULTY"
                            ? "e.g. 202000-0001"
                            : watchedRole === "STUDENT_FARMER"
                            ? "e.g. 23-04567"
                            : undefined
                        }
                        {...field}
                      />
                    </FormControl>
                    {watchedRole === "FACULTY" && (
                      <FormDescription className="text-xs">
                        Format: 123456-1234 (6 digits, dash, 4 digits)
                      </FormDescription>
                    )}
                    {watchedRole === "STUDENT_FARMER" && (
                      <FormDescription className="text-xs">
                        Format: 12-34567 (year prefix {STUDENT_ID_MIN}–{STUDENT_ID_MAX}, dash, 5 digits)
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role & access</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                <FormLabel>Role <RequiredMark /></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="FACULTY">Faculty</SelectItem>
                      <SelectItem value="STUDENT_FARMER">Student Farmer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status <RequiredMark /></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Deactivated users lose access but their data is preserved.
                    Set to Active to restore access.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                 <FormLabel>
                    Password
                    {mode === "create" ? (
                      <RequiredMark />
                    ) : (
                      <span className="text-gray-400 text-xs ml-1 font-normal">
                        (leave blank to keep current)
                      </span>
                    )}
                  </FormLabel>
             <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Minimum 8 characters, with at least 1 uppercase letter, 1
                    lowercase letter, 1 number, and 1 symbol
                  </FormDescription>
                  <PasswordStrengthIndicator password={field.value ?? ""} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {watchedRole === "FACULTY" && (
          <Card>
            <CardHeader>
              <CardTitle>Faculty details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Department
                      {isCreate && <RequiredMark />}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departmentOptions.map((dep) => (
                          <SelectItem key={dep} value={dep}>
                            {dep}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Position
                      {isCreate && <RequiredMark />}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {positionOptions.map((pos) => (
                          <SelectItem key={pos} value={pos}>
                            {pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {watchedRole === "STUDENT_FARMER" && (
          <Card>
            <CardHeader>
              <CardTitle>Student details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Course
                      {isCreate && <RequiredMark />}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courseOptions.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="yearLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Year level
                      {isCreate && <RequiredMark />}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YEAR_LEVELS.map((yl) => (
                          <SelectItem key={yl} value={yl}>
                            {yl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Section
                      {isCreate && <RequiredMark />}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BSA-1A" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Format: PREFIX-YN, e.g. BSA-1A, BTVTED-2B, BSABE-3C
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
          </Button>
    <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (
                form.formState.isDirty &&
                !confirm("Discard unsaved changes?")
              ) {
                return;
              }
              if (mode === "edit") {
                router.back();
              } else {
                router.push("/dashboard/users");
              }
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
