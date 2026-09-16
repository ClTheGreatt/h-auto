"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  assignSectionToPlot,
  assignStudent,
  getAssignableStudentsForPlot,
  getSectionAssignmentPreview,
} from "@/actions/assignments";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignmentCandidateRequestKey,
  assignmentDialogRequestKey,
  candidateSearchKeywords,
  type AssignmentCandidate,
  type AssignmentDialogMode,
} from "@/lib/assignments/assignment-filters";
import {
  COURSE_NOT_RECORDED,
  type SectionAssignmentCounts,
  type SectionAssignmentTarget,
} from "@/lib/assignments/section-assignment";
import type { AssignableStudentCohort } from "@/lib/students/assignable-students";

const COURSE_TRUNCATE_LENGTH = 24;

function courseKey(course: string | null): string {
  return JSON.stringify([course]);
}

function studentOptionLabel(student: AssignmentCandidate): string {
  const name = `${student.firstName} ${student.lastName}`;
  const details = [student.yearLevel, student.section, student.idNumber].filter(Boolean);
  if (details.length === 0 && student.course) {
    details.push(
      student.course.length > COURSE_TRUNCATE_LENGTH
        ? `${student.course.slice(0, COURSE_TRUNCATE_LENGTH)}…`
        : student.course
    );
  }
  return details.length > 0 ? `${name} · ${details.join(" · ")}` : name;
}

export function PlotAssignStudentDialog({
  plotId,
  cohorts,
}: {
  plotId: string;
  cohorts: AssignableStudentCohort[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssignmentDialogMode>("individual");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [preview, setPreview] = useState<SectionAssignmentCounts | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewRequestIdRef = useRef(0);
  const previewRequestKeyRef = useRef("");
  const [students, setStudents] = useState<AssignmentCandidate[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const studentRequestIdRef = useRef(0);
  const studentRequestKeyRef = useRef("");
  const submitPendingRef = useRef(false);
  const dialogSessionRef = useRef(0);
  const submitRequestIdRef = useRef(0);

  const courses = useMemo(
    () =>
      [...new Set(cohorts.map((cohort) => cohort.course))].sort((a, b) =>
        (a ?? "").localeCompare(b ?? "")
      ),
    [cohorts]
  );
  const sections = useMemo(
    () =>
      [
        ...new Set(
          cohorts
            .filter((cohort) => courseKey(cohort.course) === selectedCourse)
            .map((cohort) => cohort.section)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [cohorts, selectedCourse]
  );
  const selectedCohort = cohorts.find(
    (cohort) =>
      courseKey(cohort.course) === selectedCourse &&
      cohort.section === selectedSection
  );
  const selectedTarget = useMemo<SectionAssignmentTarget | null>(
    () => (selectedCohort ? { plotId, ...selectedCohort } : null),
    [plotId, selectedCohort]
  );
  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        value: student.id,
        label: studentOptionLabel(student),
        searchKeywords: candidateSearchKeywords(student),
      })),
    [students]
  );

  function clearStudentCandidates() {
    studentRequestIdRef.current += 1;
    studentRequestKeyRef.current = "";
    setStudents([]);
    setStudentsError(null);
    setLoadingStudents(false);
    setStudentSearch("");
    setSelectedStudent("");
  }

  function clearPreview() {
    previewRequestIdRef.current += 1;
    previewRequestKeyRef.current = "";
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
  }

  function reset() {
    dialogSessionRef.current += 1;
    submitRequestIdRef.current += 1;
    submitPendingRef.current = false;
    setSubmitting(false);
    clearStudentCandidates();
    clearPreview();
    setMode("individual");
    setSelectedCourse("");
    setSelectedSection("");
    setPreviewRetry(0);
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    if (!next && submitPendingRef.current) return;
    if (next && !open) dialogSessionRef.current += 1;
    setOpen(next);
    if (!next) reset();
  }

  function beginSubmit() {
    if (submitPendingRef.current) return null;
    submitPendingRef.current = true;
    const request = {
      sessionId: dialogSessionRef.current,
      requestId: ++submitRequestIdRef.current,
    };
    setSubmitting(true);
    return request;
  }

  function isCurrentSubmit(request: { sessionId: number; requestId: number }) {
    return (
      request.sessionId === dialogSessionRef.current &&
      request.requestId === submitRequestIdRef.current
    );
  }

  function finishSubmit(request: { sessionId: number; requestId: number }) {
    if (!isCurrentSubmit(request)) return;
    submitPendingRef.current = false;
    setSubmitting(false);
  }

  function closeAfterSubmit(request: { sessionId: number; requestId: number }) {
    if (!isCurrentSubmit(request)) return;
    setOpen(false);
    reset();
    router.refresh();
  }

  async function loadStudentsForTarget(target: SectionAssignmentTarget) {
    const requestId = ++studentRequestIdRef.current;
    const requestKey = assignmentCandidateRequestKey(target);
    studentRequestKeyRef.current = requestKey;
    setStudents([]);
    setStudentsError(null);
    setLoadingStudents(true);
    setStudentSearch("");
    setSelectedStudent("");

    try {
      const result = await getAssignableStudentsForPlot(target);
      if (
        requestId !== studentRequestIdRef.current ||
        requestKey !== studentRequestKeyRef.current
      ) {
        return;
      }
      if ("error" in result) {
        setStudentsError(result.error);
        return;
      }
      setStudents(result.students);
    } catch {
      if (
        requestId === studentRequestIdRef.current &&
        requestKey === studentRequestKeyRef.current
      ) {
        setStudentsError("Something went wrong. Please try again.");
      }
    } finally {
      if (
        requestId === studentRequestIdRef.current &&
        requestKey === studentRequestKeyRef.current
      ) {
        setLoadingStudents(false);
      }
    }
  }

  function handleModeChange(next: AssignmentDialogMode) {
    if (next === mode || submitPendingRef.current) return;
    clearStudentCandidates();
    clearPreview();
    setMode(next);
    if (next === "individual" && selectedTarget) {
      void loadStudentsForTarget(selectedTarget);
    } else if (next === "section" && selectedTarget) {
      setLoadingPreview(true);
    }
  }

  function handleCourseChange(value: string) {
    clearStudentCandidates();
    clearPreview();
    setSelectedCourse(value);
    setSelectedSection("");
  }

  function handleSectionChange(value: string) {
    clearStudentCandidates();
    clearPreview();
    setSelectedSection(value);
    const cohort = cohorts.find(
      (candidate) =>
        courseKey(candidate.course) === selectedCourse && candidate.section === value
    );
    if (mode === "individual" && cohort) {
      void loadStudentsForTarget({ plotId, ...cohort });
    } else if (mode === "section" && cohort) {
      setLoadingPreview(true);
    }
  }

  function retryPreview() {
    clearPreview();
    setLoadingPreview(true);
    setPreviewRetry((value) => value + 1);
  }

  useEffect(() => {
    if (!open || mode !== "section" || !selectedTarget) return;

    const target = selectedTarget;
    const requestId = ++previewRequestIdRef.current;
    const requestKey = assignmentDialogRequestKey("section", target);
    previewRequestKeyRef.current = requestKey;

    async function fetchPreview() {
      try {
        const result = await getSectionAssignmentPreview(target);
        if (
          requestId !== previewRequestIdRef.current ||
          requestKey !== previewRequestKeyRef.current
        ) {
          return;
        }
        if ("error" in result) {
          setPreviewError(
            result.error ?? "Could not load the assignment preview."
          );
          return;
        }
        setPreview(result.counts);
      } catch {
        if (
          requestId === previewRequestIdRef.current &&
          requestKey === previewRequestKeyRef.current
        ) {
          setPreviewError("Could not load the assignment preview. Please try again.");
        }
      } finally {
        if (
          requestId === previewRequestIdRef.current &&
          requestKey === previewRequestKeyRef.current
        ) {
          setLoadingPreview(false);
        }
      }
    }

    void fetchPreview();
    return () => {
      if (requestKey === previewRequestKeyRef.current) {
        previewRequestIdRef.current += 1;
        previewRequestKeyRef.current = "";
      }
    };
  }, [open, mode, plotId, selectedCourse, selectedSection, previewRetry, selectedTarget]);

  async function handleAssign() {
    if (!selectedTarget || !selectedStudent) {
      toast.error("Please select a course, section, and student");
      return;
    }
    const request = beginSubmit();
    if (!request) return;

    try {
      const result = await assignStudent(plotId, selectedStudent, notes);
      if (!isCurrentSubmit(request)) return;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Student assigned");
      closeAfterSubmit(request);
    } catch {
      if (isCurrentSubmit(request)) {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      finishSubmit(request);
    }
  }

  async function handleBulkAssign() {
    if (!selectedTarget || !preview || preview.willBeAssigned === 0) return;
    const request = beginSubmit();
    if (!request) return;

    try {
      const result = await assignSectionToPlot(selectedTarget, notes);
      if (!isCurrentSubmit(request)) return;
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.created === 0
          ? `All eligible students are already assigned to ${result.plotName}.`
          : `${result.created} ${result.created === 1 ? "student" : "students"} assigned to ${result.plotName}. ${result.alreadyAssigned} already assigned.`
      );
      closeAfterSubmit(request);
    } catch {
      if (isCurrentSubmit(request)) {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      finishSubmit(request);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-2 size-4" />
          Assign student
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!submitting}
        onEscapeKeyDown={(event) => {
          if (submitPendingRef.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (submitPendingRef.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submitPendingRef.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Assign student farmers</DialogTitle>
          <DialogDescription>
            Assign an individual student or an eligible section to monitor this plot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Assignment Mode</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="plot-assignment-mode"
                  value="individual"
                  checked={mode === "individual"}
                  onChange={() => handleModeChange("individual")}
                  disabled={submitting}
                />
                Individual Student
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="plot-assignment-mode"
                  value="section"
                  checked={mode === "section"}
                  onChange={() => handleModeChange("section")}
                  disabled={submitting}
                />
                Entire Section
              </label>
            </div>
          </fieldset>
          {cohorts.length === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title="No eligible course/section cohorts"
              description="Only active, non-graduated student farmers in authorized sections can be assigned."
            />
          ) : (
            <>
              <div className="min-w-0">
                <Label htmlFor="plot-assign-course">Course</Label>
                <Select
                  value={selectedCourse}
                  onValueChange={handleCourseChange}
                  disabled={submitting}
                >
                  <SelectTrigger id="plot-assign-course" className="w-full min-w-0">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={courseKey(course)} value={courseKey(course)}>
                        <span className="block max-w-full truncate" title={course ?? COURSE_NOT_RECORDED}>
                          {course ?? COURSE_NOT_RECORDED}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="plot-assign-section">Section</Label>
                <Select
                  value={selectedSection}
                  onValueChange={handleSectionChange}
                  disabled={!selectedCourse || submitting}
                >
                  <SelectTrigger id="plot-assign-section" className="w-full min-w-0">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section} value={section}>
                        <span className="block max-w-full truncate" title={section}>
                          {section}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode === "individual" ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="plot-assign-student">Student</Label>
                  <SearchableSelect
                    options={studentOptions}
                    value={selectedStudent || undefined}
                    onChange={(value) => setSelectedStudent(value ?? "")}
                    allLabel={loadingStudents ? "Loading..." : "Search/select student"}
                    searchPlaceholder="Search name, email, or student number..."
                    emptyText="No eligible students found."
                    width="w-full"
                    disabled={
                      !selectedTarget ||
                      loadingStudents ||
                      Boolean(studentsError) ||
                      submitting
                    }
                    allowEmptySelection={false}
                    triggerId="plot-assign-student"
                    ariaLabel="Select an eligible student"
                    searchValue={studentSearch}
                    onSearchValueChange={setStudentSearch}
                  />
                  {studentsError ? (
                    <div>
                      <p className="text-sm text-destructive" role="alert">
                        {studentsError}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          if (selectedTarget) {
                            void loadStudentsForTarget(selectedTarget);
                          }
                        }}
                        disabled={submitting || !selectedTarget}
                      >
                        Retry students
                      </Button>
                    </div>
                  ) : selectedTarget && !loadingStudents && students.length === 0 ? (
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      No eligible students match this course and section. Students already
                      active on this plot are excluded.
                    </p>
                  ) : null}
                </div>
              ) : selectedTarget ? (
                <div
                  className="rounded-md border bg-muted/30 p-3 text-sm"
                  aria-live="polite"
                >
                  <p className="mb-2 font-medium">Assignment Preview</p>
                  {loadingPreview ? (
                    <p>Loading assignment preview...</p>
                  ) : previewError ? (
                    <div>
                      <p className="text-destructive" role="alert">
                        {previewError}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={retryPreview}
                        disabled={submitting}
                      >
                        Retry preview
                      </Button>
                    </div>
                  ) : preview ? (
                    <>
                      <dl className="space-y-1">
                        <div className="flex justify-between gap-3">
                          <dt>Eligible Student Farmers</dt>
                          <dd>{preview.eligibleStudents}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Already assigned</dt>
                          <dd>{preview.alreadyAssigned}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Will be assigned</dt>
                          <dd>{preview.willBeAssigned}</dd>
                        </div>
                      </dl>
                      {preview.willBeAssigned === 0 ? (
                        <p className="mt-2 text-muted-foreground">
                          All eligible students in this course and section are already
                          assigned to this plot.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
          <div>
            <Label htmlFor="plot-assign-notes">Notes (optional)</Label>
            <Input
              id="plot-assign-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Watering schedule, special instructions"
              disabled={submitting}
            />
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
            onClick={mode === "individual" ? handleAssign : handleBulkAssign}
            disabled={
              submitting ||
              (mode === "individual"
                ? !selectedTarget || !selectedStudent
                : !selectedTarget ||
                  loadingPreview ||
                  !preview ||
                  preview.willBeAssigned === 0)
            }
          >
            {submitting
              ? "Assigning..."
              : mode === "individual"
                ? "Assign Student"
                : preview
                  ? `Assign ${preview.willBeAssigned} ${preview.willBeAssigned === 1 ? "Student" : "Students"}`
                  : "Assign Students"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
