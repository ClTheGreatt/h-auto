"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, MapPinned, Users } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  assignSectionToPlot,
  assignStudent,
  getAssignableStudentsForPlot,
  getSectionAssignmentPreview,
} from "@/actions/assignments";
import {
  COURSE_NOT_RECORDED,
  type SectionAssignmentCounts,
  type SectionAssignmentTarget,
} from "@/lib/assignments/section-assignment";
import {
  assignmentCandidateRequestKey,
  candidateSearchKeywords,
  type AssignmentCandidate,
} from "@/lib/assignments/assignment-filters";

type Plot = { id: string; name: string };
type BulkCohort = { course: string | null; section: string };
type AssignmentMode = "individual" | "section";

function courseKey(course: string | null): string {
  return JSON.stringify([course]);
}

const COURSE_TRUNCATE_LENGTH = 24;

// Keep the existing name/year/section context and add the student number
// when present so similarly named candidates remain distinguishable.
function studentOptionLabel(s: AssignmentCandidate): string {
  const name = `${s.firstName} ${s.lastName}`;
  const details = [s.yearLevel, s.section, s.idNumber].filter(Boolean);
  if (details.length === 0 && s.course) {
    const short =
      s.course.length > COURSE_TRUNCATE_LENGTH
        ? `${s.course.slice(0, COURSE_TRUNCATE_LENGTH)}…`
        : s.course;
    details.push(short);
  }
  return details.length > 0 ? `${name} · ${details.join(" · ")}` : name;
}

export function AssignStudentDialog({
  plots,
  bulkCohorts,
}: {
  plots: Plot[];
  bulkCohorts: BulkCohort[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState("");
  const [mode, setMode] = useState<AssignmentMode>("individual");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [preview, setPreview] = useState<SectionAssignmentCounts | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewRequestIdRef = useRef(0);
  const [students, setStudents] = useState<AssignmentCandidate[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const studentRequestIdRef = useRef(0);
  const studentRequestKeyRef = useRef("");
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitPendingRef = useRef(false);
  const dialogSessionRef = useRef(0);
  const submitRequestIdRef = useRef(0);
  const courses = useMemo(
    () => [...new Set(bulkCohorts.map((cohort) => cohort.course))].sort(
      (a, b) => (a ?? "").localeCompare(b ?? "")
    ),
    [bulkCohorts]
  );
  const sections = useMemo(() => {
    const course = courses.find((value) => courseKey(value) === selectedCourse);
    if (course === undefined && selectedCourse !== courseKey(null)) return [];
    return [...new Set(
      bulkCohorts
        .filter((cohort) => courseKey(cohort.course) === selectedCourse)
        .map((cohort) => cohort.section)
    )].sort((a, b) => a.localeCompare(b));
  }, [bulkCohorts, courses, selectedCourse]);
  const selectedCourseValue = bulkCohorts.find(
    (cohort) => courseKey(cohort.course) === selectedCourse
  )?.course;
  const validCohortTarget = Boolean(
    selectedPlot && selectedCourse && selectedSection &&
    bulkCohorts.some((cohort) =>
      courseKey(cohort.course) === selectedCourse && cohort.section === selectedSection
    )
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

  function reset() {
    dialogSessionRef.current += 1;
    submitRequestIdRef.current += 1;
    submitPendingRef.current = false;
    setSubmitting(false);
    studentRequestIdRef.current += 1;
    previewRequestIdRef.current += 1;
    setMode("individual");
    setSelectedPlot("");
    setSelectedCourse("");
    setSelectedSection("");
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
    setPreviewRetry(0);
    setStudents([]);
    setLoadingStudents(false);
    studentRequestKeyRef.current = "";
    setStudentsError(null);
    setStudentSearch("");
    setSelectedStudent("");
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    // The ref closes the gap before React renders the pending button state.
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
    return request.sessionId === dialogSessionRef.current &&
      request.requestId === submitRequestIdRef.current;
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

  function clearStudentCandidates() {
    studentRequestIdRef.current += 1;
    studentRequestKeyRef.current = "";
    setStudents([]);
    setStudentsError(null);
    setLoadingStudents(false);
    setStudentSearch("");
    setSelectedStudent("");
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
      ) return;

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

  function handlePlotChange(plotId: string) {
    previewRequestIdRef.current += 1;
    setSelectedPlot(plotId);
    setPreview(null);
    setPreviewError(null);
    clearStudentCandidates();

    const courseIsValid = bulkCohorts.some(
      (cohort) => courseKey(cohort.course) === selectedCourse
    );
    const cohort = bulkCohorts.find(
      (candidate) =>
        courseKey(candidate.course) === selectedCourse &&
        candidate.section === selectedSection
    );
    if (!courseIsValid) setSelectedCourse("");
    if (!cohort) setSelectedSection("");
    setLoadingPreview(mode === "section" && Boolean(cohort));
    if (mode === "individual" && cohort) {
      void loadStudentsForTarget({ plotId, ...cohort });
    }
  }

  function handleModeChange(next: AssignmentMode) {
    if (next === mode || submitPendingRef.current) return;
    previewRequestIdRef.current += 1;
    setMode(next);
    clearStudentCandidates();
    setPreview(null);
    setPreviewError(null);
    const courseIsValid = bulkCohorts.some(
      (candidate) => courseKey(candidate.course) === selectedCourse
    );
    const cohort = bulkCohorts.find(
      (candidate) =>
        courseKey(candidate.course) === selectedCourse &&
        candidate.section === selectedSection
    );
    if (!courseIsValid) setSelectedCourse("");
    if (!cohort) setSelectedSection("");
    setLoadingPreview(next === "section" && Boolean(selectedPlot && cohort));
    if (next === "individual" && selectedPlot && cohort) {
      void loadStudentsForTarget({ plotId: selectedPlot, ...cohort });
    }
  }

  function handleCourseChange(value: string) {
    previewRequestIdRef.current += 1;
    clearStudentCandidates();
    setSelectedCourse(value);
    setSelectedSection("");
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
  }

  function handleSectionChange(value: string) {
    previewRequestIdRef.current += 1;
    clearStudentCandidates();
    setSelectedSection(value);
    setPreview(null);
    setPreviewError(null);

    const cohort = bulkCohorts.find(
      (candidate) =>
        courseKey(candidate.course) === selectedCourse &&
        candidate.section === value
    );
    setLoadingPreview(mode === "section" && Boolean(selectedPlot && cohort));
    if (mode === "individual" && selectedPlot && cohort) {
      void loadStudentsForTarget({ plotId: selectedPlot, ...cohort });
    }
  }

  function retryPreview() {
    previewRequestIdRef.current += 1;
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(true);
    setPreviewRetry((value) => value + 1);
  }

  useEffect(() => {
    if (!open || mode !== "section" || !validCohortTarget) {
      return;
    }
    const requestId = ++previewRequestIdRef.current;
    const course = selectedCourseValue;
    async function fetchPreview() {
      try {
        const result = await getSectionAssignmentPreview({
          plotId: selectedPlot,
          course: course ?? null,
          section: selectedSection,
        });
        if (requestId !== previewRequestIdRef.current) return;
        if ("error" in result) setPreviewError(result.error ?? "Could not load the assignment preview.");
        else setPreview(result.counts);
      } catch {
        if (requestId === previewRequestIdRef.current) {
          setPreviewError("Could not load the assignment preview. Please try again.");
        }
      } finally {
        if (requestId === previewRequestIdRef.current) setLoadingPreview(false);
      }
    }
    void fetchPreview();
    return () => { previewRequestIdRef.current += 1; };
  }, [open, mode, validCohortTarget, selectedPlot, selectedCourse, selectedSection, selectedCourseValue, previewRetry]);

  async function handleAssign() {
    if (!validCohortTarget || !selectedStudent) {
      toast.error("Please select a plot, course, section, and student");
      return;
    }
    const request = beginSubmit();
    if (!request) return;

    try {
      const result = await assignStudent(selectedPlot, selectedStudent, notes);
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
    if (!validCohortTarget || !preview || preview.willBeAssigned === 0) return;
    const request = beginSubmit();
    if (!request) return;
    try {
      const result = await assignSectionToPlot({
        plotId: selectedPlot,
        course: selectedCourseValue ?? null,
        section: selectedSection,
      }, notes);
      if (!isCurrentSubmit(request)) return;
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.created === 0
        ? `All eligible students are already assigned to ${result.plotName}.`
        : `${result.created} ${result.created === 1 ? "student" : "students"} assigned to ${result.plotName}. ${result.alreadyAssigned} already assigned.`);
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
          <UserPlus className="w-4 h-4 mr-2" />
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
            Assign one student or an entire course and section to a plot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Assignment Mode</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="assignment-mode"
                  value="individual"
                  checked={mode === "individual"}
                  onChange={() => handleModeChange("individual")}
                  disabled={submitting}
                />
                Individual Student
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="assignment-mode"
                  value="section"
                  checked={mode === "section"}
                  onChange={() => handleModeChange("section")}
                  disabled={submitting}
                />
                Entire Section
              </label>
            </div>
          </fieldset>
          <div>
            <Label htmlFor="assign-plot-select">Plot</Label>
            {plots.length === 0 ? (
              <EmptyState
                compact
                icon={MapPinned}
                title="No plots available"
                description="Students can only be assigned to a plot that has an adviser and hasn't been harvested or archived yet. None of your plots currently qualify."
              />
            ) : (
              <Select value={selectedPlot} onValueChange={handlePlotChange} disabled={submitting}>
                <SelectTrigger id="assign-plot-select">
                  <SelectValue placeholder="Select a plot" />
                </SelectTrigger>
                <SelectContent>
                  {plots.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedPlot && (
            <div className="space-y-4">
              {bulkCohorts.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title="No eligible course/section cohorts"
                  description="Only active, non-graduated student farmers in authorized sections can be assigned."
                />
              ) : (
                <>
                  <div>
                    <Label htmlFor="assign-course-select">Course</Label>
                    <Select value={selectedCourse} onValueChange={handleCourseChange} disabled={submitting}>
                      <SelectTrigger id="assign-course-select">
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={courseKey(course)} value={courseKey(course)}>
                            {course ?? COURSE_NOT_RECORDED}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assign-section-select">Section</Label>
                    <Select
                      value={selectedSection}
                      onValueChange={handleSectionChange}
                      disabled={!selectedCourse || submitting}
                    >
                      <SelectTrigger id="assign-section-select">
                        <SelectValue placeholder="Select a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section} value={section}>
                            {section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {mode === "individual" ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="assign-student-select">Student</Label>
                        <SearchableSelect
                          options={studentOptions}
                          value={selectedStudent || undefined}
                          onChange={(value) => setSelectedStudent(value ?? "")}
                          allLabel={loadingStudents ? "Loading..." : "Search student"}
                          searchPlaceholder="Search name, email, or student number..."
                          emptyText="No eligible students found."
                          width="w-full"
                          disabled={!validCohortTarget || loadingStudents || submitting}
                          allowEmptySelection={false}
                          triggerId="assign-student-select"
                          ariaLabel="Select an eligible student"
                          searchValue={studentSearch}
                          onSearchValueChange={setStudentSearch}
                        />
                      </div>
                      {studentsError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {studentsError}
                        </p>
                      ) : validCohortTarget && !loadingStudents && students.length === 0 ? (
                        <EmptyState
                          compact
                          icon={Users}
                          title="No eligible students"
                          description="Only active, non-graduated student farmers in the selected course and section can be assigned. Students already active on this plot are excluded."
                        />
                      ) : null}
                    </div>
                  ) : validCohortTarget ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm" aria-live="polite">
                      <p className="font-medium mb-2">Assignment Preview</p>
                      {loadingPreview ? (
                        <p>Loading assignment preview...</p>
                      ) : previewError ? (
                        <div>
                          <p className="text-destructive" role="alert">{previewError}</p>
                          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={retryPreview} disabled={submitting}>
                            Retry preview
                          </Button>
                        </div>
                      ) : preview ? (
                        <>
                          <dl className="space-y-1">
                            <div className="flex justify-between gap-3"><dt>Eligible Student Farmers</dt><dd>{preview.eligibleStudents}</dd></div>
                            <div className="flex justify-between gap-3"><dt>Already assigned</dt><dd>{preview.alreadyAssigned}</dd></div>
                            <div className="flex justify-between gap-3"><dt>Will be assigned</dt><dd>{preview.willBeAssigned}</dd></div>
                          </dl>
                          {preview.willBeAssigned === 0 && (
                            <p className="mt-2 text-muted-foreground">All eligible students in this course and section are already assigned to this plot.</p>
                          )}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="assign-notes">Notes (optional)</Label>
            <Input
              id="assign-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Watering schedule, special instructions"
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={mode === "individual" ? handleAssign : handleBulkAssign}
            disabled={submitting || (mode === "individual"
              ? !validCohortTarget || !selectedStudent
              : !validCohortTarget || loadingPreview || !preview || preview.willBeAssigned === 0)}
          >
            {submitting
              ? "Assigning..."
              : mode === "individual"
                ? "Assign"
                : preview
                  ? `Assign ${preview.willBeAssigned} ${preview.willBeAssigned === 1 ? "Student" : "Students"}`
                  : "Assign Students"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
