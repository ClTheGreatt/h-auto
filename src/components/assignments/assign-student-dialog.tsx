"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
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
import { assignStudent, getAssignableStudentsForPlot } from "@/actions/assignments";
import {
  candidateSearchKeywords,
  candidateSections,
  candidatesInSection,
  defaultCandidateSection,
  shouldClearSelectedStudent,
  type AssignmentCandidate,
} from "@/lib/assignments/assignment-filters";

type Plot = { id: string; name: string };

const COURSE_TRUNCATE_LENGTH = 24;
const ALL_SECTIONS = "__all_sections__";

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
  role,
}: {
  plots: Plot[];
  role: UserRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState("");
  const [students, setStudents] = useState<AssignmentCandidate[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const studentRequestIdRef = useRef(0);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState(ALL_SECTIONS);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sections = useMemo(() => candidateSections(students), [students]);
  const visibleStudents = useMemo(
    () =>
      candidatesInSection(
        students,
        selectedSection === ALL_SECTIONS ? undefined : selectedSection
      ),
    [selectedSection, students]
  );
  const studentOptions = useMemo(
    () =>
      visibleStudents.map((student) => ({
        value: student.id,
        label: studentOptionLabel(student),
        searchKeywords: candidateSearchKeywords(student),
      })),
    [visibleStudents]
  );

  function reset() {
    studentRequestIdRef.current += 1;
    setSelectedPlot("");
    setStudents([]);
    setLoadingStudents(false);
    setStudentsError(null);
    setSelectedSection(ALL_SECTIONS);
    setStudentSearch("");
    setSelectedStudent("");
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handlePlotChange(plotId: string) {
    const requestId = ++studentRequestIdRef.current;

    setSelectedPlot(plotId);
    setSelectedSection(ALL_SECTIONS);
    setStudentSearch("");
    setSelectedStudent("");
    setStudents([]);
    setStudentsError(null);
    setLoadingStudents(true);

    try {
      const result = await getAssignableStudentsForPlot(plotId);

      if (requestId !== studentRequestIdRef.current) return;

      if ("error" in result) {
        setStudentsError(result.error);
        return;
      }
      setStudents(result.students);
      const nextSections = candidateSections(result.students);
      setSelectedSection(
        defaultCandidateSection(role, nextSections) ?? ALL_SECTIONS
      );
    } catch {
      if (requestId === studentRequestIdRef.current) {
        setStudentsError("Something went wrong. Please try again.");
      }
    } finally {
      if (requestId === studentRequestIdRef.current) {
        setLoadingStudents(false);
      }
    }
  }

  function handleSectionChange(nextSection: string) {
    const section = nextSection === ALL_SECTIONS ? undefined : nextSection;
    if (shouldClearSelectedStudent(students, selectedStudent, section)) {
      setSelectedStudent("");
    }
    setSelectedSection(nextSection);
  }

  async function handleAssign() {
    if (!selectedPlot || !selectedStudent) {
      toast.error("Please select a plot and a student");
      return;
    }
    setSubmitting(true);

    try {
      const result = await assignStudent(selectedPlot, selectedStudent, notes);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Student assigned");
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a student farmer</DialogTitle>
          <DialogDescription>
            Select a plot, then a student to monitor it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
              <Select value={selectedPlot} onValueChange={handlePlotChange}>
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
              {studentsError ? (
                <p className="text-sm text-destructive" role="alert">
                  {studentsError}
                </p>
              ) : !loadingStudents && students.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title="No eligible students"
                  description="Only active, non-graduated student farmers can be assigned — and for faculty, only those in a section you advise. No one currently matches for this plot."
                />
              ) : (
                <>
                  {!loadingStudents && students.length > 0 && (
                    <div>
                      <Label htmlFor="assign-section-select">Section</Label>
                      <Select
                        value={selectedSection}
                        onValueChange={handleSectionChange}
                      >
                        <SelectTrigger id="assign-section-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_SECTIONS}>
                            {role === "FACULTY"
                              ? "All authorized sections"
                              : "All sections"}
                          </SelectItem>
                          {sections.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="assign-student-select">Student</Label>
                    <SearchableSelect
                      options={studentOptions}
                      value={selectedStudent || undefined}
                      onChange={(value) => setSelectedStudent(value ?? "")}
                      allLabel={
                        loadingStudents ? "Loading..." : "Select a student"
                      }
                      searchPlaceholder="Search name, email, or student number..."
                      emptyText="No eligible students found."
                      width="w-full"
                      disabled={loadingStudents}
                      allowEmptySelection={false}
                      triggerId="assign-student-select"
                      ariaLabel="Select an eligible student"
                      searchValue={studentSearch}
                      onSearchValueChange={setStudentSearch}
                    />
                  </div>
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
            onClick={handleAssign}
            disabled={submitting || !selectedPlot || !selectedStudent}
          >
            {submitting ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
