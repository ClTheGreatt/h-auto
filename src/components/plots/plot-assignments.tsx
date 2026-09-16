"use client";

import { X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { AssignableStudentCohort } from "@/lib/students/assignable-students";
import { PlotAssignStudentDialog } from "./plot-assign-student-dialog";
import { RemoveAssignmentDialog } from "./remove-assignment-dialog";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  course: string | null;
  yearLevel: string | null;
  section: string | null;
};

type Assignment = {
  id: string;
  notes: string | null;
  assignedAt: Date;
  student: Student;
  // The plot's supervising adviser (Plot.facultyId, copied onto every
  // assignment row for this plot) — identical across every row, so it is
  // rendered once in the card header rather than per row.
  faculty: { firstName: string; lastName: string; position: string | null };
  // Who actually clicked Assign. Older rows may not have this value; never
  // substitute the supervising adviser because those are different roles.
  assignedBy: { firstName: string; lastName: string } | null;
};

export function PlotAssignments({
  plotId,
  assignments,
  cohorts,
  canManage,
  canAssign,
}: {
  plotId: string;
  assignments: Assignment[];
  cohorts: AssignableStudentCohort[];
  canManage: boolean;
  canAssign: boolean;
}) {
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
          {assignments.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Adviser: {assignments[0].faculty.firstName} {assignments[0].faculty.lastName}
              {assignments[0].faculty.position && ` · ${assignments[0].faculty.position}`}
            </p>
          )}
        </div>
        {canAssign && <PlotAssignStudentDialog plotId={plotId} cohorts={cohorts} />}
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
                    {a.assignedBy
                      ? `Assigned by ${a.assignedBy.firstName} ${a.assignedBy.lastName} · ${formatDate(a.assignedAt)}`
                      : `Assigned ${formatDate(a.assignedAt)}`}
                  </div>
                </div>
                {canManage && (
                  <RemoveAssignmentDialog
                    assignmentId={a.id}
                    studentName={`${a.student.firstName} ${a.student.lastName}`}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger-text hover:text-danger-text"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
