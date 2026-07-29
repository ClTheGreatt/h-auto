"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignStudent, removeAssignment } from "@/actions/assignments";
import { formatDate } from "@/lib/format-date";

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

// Prefers "yearLevel · section" (short, e.g. "3rd Year · BSIT-3A") over the
// full course name, which can be long enough to overflow the dropdown.
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

type Assignment = {
  id: string;
  notes: string | null;
  assignedAt: Date;
  student: Student;
  // The plot's supervising adviser (Plot.facultyId, copied onto every
  // assignment row for this plot) — NOT who performed the assign action.
  // PlotAssignment has no assignedById field, so this must never be labeled
  // "Assigned by".
  faculty: { firstName: string; lastName: string; position: string | null };
};

export function PlotAssignments({
  plotId,
  assignments,
  availableStudents,
  canManage,
  facultyHasNoAdvisories,
  viewerIsFaculty,
}: {
  plotId: string;
  assignments: Assignment[];
  availableStudents: Student[];
  canManage: boolean;
  facultyHasNoAdvisories: boolean;
  viewerIsFaculty: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const assignedIds = new Set(assignments.map((a) => a.student.id));
  const unassigned = availableStudents.filter((s) => !assignedIds.has(s.id));

  async function handleAssign() {
    if (!selectedStudent) {
      toast.error("Please select a student");
      return;
    }
    setSubmitting(true);
    const result = await assignStudent(plotId, selectedStudent, notes);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Student assigned");
    setDialogOpen(false);
    setSelectedStudent("");
    setNotes("");
    router.refresh();
  }

  async function handleRemove(assignmentId: string) {
    const result = await removeAssignment(assignmentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assignment removed");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Assigned student farmers</h3>
          <p className="text-xs text-muted-foreground">
            {assignments.length === 0
              ? "No one is assigned yet."
              : `${assignments.length} student${assignments.length === 1 ? "" : "s"} monitoring this plot.`}
          </p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  Select a student to monitor this plot.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="student-select">Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger id="student-select">
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {facultyHasNoAdvisories
                            ? "You have no advised sections assigned. Contact an administrator to set them up."
                            : viewerIsFaculty
                            ? "No eligible students in your advised sections."
                            : "No available students"}
                        </div>
                      ) : (
                        unassigned.map((s) => {
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
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Watering schedule, special instructions"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleAssign} disabled={submitting || !selectedStudent}>
                  {submitting ? "Assigning..." : "Assign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {assignments.length > 0 && (
        <div className="space-y-2">
          {assignments.map((a) => {
            const initials = `${a.student.firstName[0]}${a.student.lastName[0]}`.toUpperCase();
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 bg-muted rounded-md"
              >
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {a.student.firstName} {a.student.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.student.email}
                    {a.student.course && ` • ${a.student.course}`}
                  </div>
                  {a.notes && (
                    <div className="text-xs text-muted-foreground mt-1 italic">
                      &ldquo;{a.notes}&rdquo;
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    <div>
                      Adviser: {a.faculty.firstName} {a.faculty.lastName}
                    </div>
                    {a.faculty.position && <div>{a.faculty.position}</div>}
                    <div>Assigned {formatDate(a.assignedAt)}</div>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleRemove(a.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}