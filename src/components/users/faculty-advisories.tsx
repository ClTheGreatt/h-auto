"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setFacultyAdvisories } from "@/actions/advisories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MISSING_FACULTY_DEPARTMENT_ERROR,
  academicCohortKey,
  isAdvisoryResolvedForDepartment,
  isCanonicalAcademicProgram,
  type AcademicCohort,
  type AdvisoryIdentity,
} from "@/lib/academics/cohort-integrity";

function sameCohorts(left: AcademicCohort[], right: AcademicCohort[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(academicCohortKey));
  return left.every((cohort) => rightKeys.has(academicCohortKey(cohort)));
}

export function FacultyAdvisories({
  facultyId,
  department,
  initialAdvisories,
  availableCohorts,
  canManageAdvisories,
}: {
  facultyId: string;
  department: string | null;
  initialAdvisories: AdvisoryIdentity[];
  availableCohorts: AcademicCohort[];
  canManageAdvisories: boolean;
}) {
  const router = useRouter();
  const [advisories, setAdvisories] = useState(initialAdvisories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingCohorts, setPendingCohorts] = useState<AcademicCohort[]>([]);
  const [removeReviewIds, setRemoveReviewIds] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resolved = advisories.flatMap((advisory) =>
    isAdvisoryResolvedForDepartment(department, advisory)
      ? [{ course: advisory.course, section: advisory.section }]
      : []
  );
  const needsReview = advisories.filter(
    (advisory) => !isAdvisoryResolvedForDepartment(department, advisory)
  );
  const departmentIsCanonical = isCanonicalAcademicProgram(department);
  const remainingOptions = availableCohorts.filter(
    (option) =>
      !pendingCohorts.some(
        (pending) => academicCohortKey(pending) === academicCohortKey(option)
      )
  );
  const hasChanges =
    !sameCohorts(pendingCohorts, resolved) || removeReviewIds.length > 0;

  function openDialog() {
    setPendingCohorts(resolved);
    setRemoveReviewIds([]);
    setSelectedSection("");
    setDialogOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next && submitting) return;
    setDialogOpen(next);
    if (!next) {
      setSelectedSection("");
      setRemoveReviewIds([]);
    }
  }

  function addCohort() {
    const cohort = availableCohorts.find(
      (option) => option.section === selectedSection
    );
    if (!cohort) return;
    setPendingCohorts((current) =>
      current.some(
        (pending) => academicCohortKey(pending) === academicCohortKey(cohort)
      )
        ? current
        : [...current, cohort]
    );
    setSelectedSection("");
  }

  async function handleSave() {
    if (!hasChanges || submitting) return;
    setSubmitting(true);
    try {
      const result = await setFacultyAdvisories(
        facultyId,
        pendingCohorts,
        removeReviewIds
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      const removedForReview = new Set(removeReviewIds);
      setAdvisories([
        ...needsReview.filter(
          (advisory) => !removedForReview.has(advisory.id)
        ),
        ...pendingCohorts.map((cohort) => ({
          id: academicCohortKey(cohort),
          ...cohort,
        })),
      ]);
      toast.success("Advised cohorts updated");
      setDialogOpen(false);
      setRemoveReviewIds([]);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Advised cohorts</h3>
          <p className="text-xs text-muted-foreground">
            {advisories.length === 0
              ? "No advised cohorts yet."
              : `${advisories.length} cohort${advisories.length === 1 ? "" : "s"} recorded.`}
          </p>
        </div>
        {canManageAdvisories ? (
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  openDialog();
                }}
              >
                <Pencil className="mr-2 size-4" />
                Edit cohorts
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
              showCloseButton={!submitting}
              onClick={(event) => event.stopPropagation()}
              onEscapeKeyDown={(event) => {
                if (submitting) event.preventDefault();
              }}
              onPointerDownOutside={(event) => {
                if (submitting) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (submitting) event.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>Edit advised cohorts</DialogTitle>
                <DialogDescription>
                  Add compatible Course / Program and Section pairs. Rows needing
                  review remain until explicitly removed.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Faculty Department</Label>
                    <div className="min-h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      {department || "Not recorded"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Course / Program</Label>
                    <div className="min-h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      {departmentIsCanonical ? department : "Unavailable"}
                    </div>
                  </div>
                </div>

                {!departmentIsCanonical ? (
                  <p className="text-sm text-destructive" role="alert">
                    {MISSING_FACULTY_DEPARTMENT_ERROR}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="faculty-advisory-section">Section</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={selectedSection}
                        onValueChange={setSelectedSection}
                        disabled={submitting || remainingOptions.length === 0}
                      >
                        <SelectTrigger
                          id="faculty-advisory-section"
                          className="w-full"
                        >
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          {remainingOptions.map((cohort) => (
                            <SelectItem
                              key={academicCohortKey(cohort)}
                              value={cohort.section}
                            >
                              {cohort.section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addCohort}
                        disabled={!selectedSection || submitting}
                      >
                        Add cohort
                      </Button>
                    </div>
                    {availableCohorts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No Student Farmer cohorts match this Faculty department.
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Current advised cohorts</h4>
                  {pendingCohorts.length === 0 && needsReview.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No advised cohorts yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pendingCohorts.map((cohort) => (
                        <div
                          key={academicCohortKey(cohort)}
                          className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{cohort.course}</p>
                            <p className="text-muted-foreground">{cohort.section}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPendingCohorts((current) =>
                                current.filter(
                                  (item) =>
                                    academicCohortKey(item) !==
                                    academicCohortKey(cohort)
                                )
                              )
                            }
                            disabled={submitting}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Remove
                          </Button>
                        </div>
                      ))}
                      {needsReview.map((advisory) => {
                        const markedForRemoval = removeReviewIds.includes(advisory.id);
                        return (
                          <div
                            key={advisory.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {advisory.course ?? "Course not recorded"}
                                </p>
                                <Badge
                                  variant={
                                    markedForRemoval ? "destructive" : "secondary"
                                  }
                                >
                                  {markedForRemoval
                                    ? "Will remove on save"
                                    : "Needs review"}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground">
                                {advisory.section}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant={markedForRemoval ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() =>
                                setRemoveReviewIds((current) =>
                                  markedForRemoval
                                    ? current.filter((id) => id !== advisory.id)
                                    : [...current, advisory.id]
                                )
                              }
                              disabled={submitting}
                            >
                              {markedForRemoval ? "Keep" : "Remove"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || submitting}
                >
                  {submitting ? "Saving..." : "Save cohorts"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {advisories.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Course / Program</span>
            <span>Section</span>
            <span>Status</span>
          </div>
          {advisories.map((advisory) => (
            <div
              key={advisory.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 truncate">
                {advisory.course ?? "Course not recorded"}
              </span>
              <span>{advisory.section}</span>
              {isAdvisoryResolvedForDepartment(department, advisory) ? (
                <span className="text-xs text-muted-foreground">Active</span>
              ) : (
                <Badge variant="secondary">Needs review</Badge>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
