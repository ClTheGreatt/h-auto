"use client";

import { useState } from "react";
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
import { assignStudent, getAssignableStudentsForPlot } from "@/actions/assignments";

type Plot = { id: string; name: string };

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  course: string | null;
  yearLevel: string | null;
  section: string | null;
};

const COURSE_TRUNCATE_LENGTH = 24;

// Same label logic as plot-assignments.tsx's studentOptionLabel — mirrored
// rather than shared since that one is local/unexported to that file.
function studentOptionLabel(s: Student): { label: string; full: string } {
  const name = `${s.firstName} ${s.lastName}`;
  if (s.yearLevel && s.section) {
    return { label: `${name} · ${s.yearLevel} · ${s.section}`, full: s.course ?? name };
  }
  if (s.course) {
    const short =
      s.course.length > COURSE_TRUNCATE_LENGTH
        ? `${s.course.slice(0, COURSE_TRUNCATE_LENGTH)}…`
        : s.course;
    return { label: `${name} · ${short}`, full: s.course };
  }
  return { label: name, full: name };
}

export function AssignStudentDialog({ plots }: { plots: Plot[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setSelectedPlot("");
    setStudents([]);
    setStudentsError(null);
    setSelectedStudent("");
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handlePlotChange(plotId: string) {
    setSelectedPlot(plotId);
    setSelectedStudent("");
    setStudents([]);
    setStudentsError(null);
    setLoadingStudents(true);
    const result = await getAssignableStudentsForPlot(plotId);
    setLoadingStudents(false);

    if ("error" in result) {
      setStudentsError(result.error);
      return;
    }
    setStudents(result.students);
  }

  async function handleAssign() {
    if (!selectedPlot || !selectedStudent) {
      toast.error("Please select a plot and a student");
      return;
    }
    setSubmitting(true);
    const result = await assignStudent(selectedPlot, selectedStudent, notes);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Student assigned");
    setOpen(false);
    reset();
    router.refresh();
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
            <div>
              <Label htmlFor="assign-student-select">Student</Label>
              {studentsError ? (
                <p className="text-sm text-destructive mt-1">{studentsError}</p>
              ) : !loadingStudents && students.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title="No eligible students"
                  description="Only active, non-graduated student farmers can be assigned — and for faculty, only those in a section you advise. No one currently matches for this plot."
                />
              ) : (
                <Select
                  value={selectedStudent}
                  onValueChange={setSelectedStudent}
                  disabled={loadingStudents}
                >
                  <SelectTrigger id="assign-student-select">
                    <SelectValue
                      placeholder={loadingStudents ? "Loading..." : "Select a student"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => {
                      const { label, full } = studentOptionLabel(s);
                      return (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          title={full}
                          className="max-w-full"
                        >
                          <span className="truncate">{label}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
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
