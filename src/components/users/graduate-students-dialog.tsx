"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { graduateStudents } from "@/actions/users";
import { graduationYearWarning } from "@/lib/constants/user-import";

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  course: string | null;
  yearLevel: string | null;
  section: string | null;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GraduateStudentsDialog({ students }: { students: Candidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [graduationDate, setGraduationDate] = useState(todayIsoDate);
  // All checked by default — each individually uncheckable. Reset whenever
  // the dialog (re)opens, in case the filtered student list changed.
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(students.map((s) => s.id))
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setChecked(new Set(students.map((s) => s.id)));
      setGraduationDate(todayIsoDate());
    }
    setOpen(next);
  }

  const warnedCheckedCount = students.filter(
    (s) => checked.has(s.id) && graduationYearWarning(s.course, s.yearLevel)
  ).length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (checked.size === 0) return;

    setSubmitting(true);
    const result = await graduateStudents(
      [...checked],
      new Date(graduationDate)
    );
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Marked ${result.count} student${result.count === 1 ? "" : "s"} as graduated`
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <GraduationCap className="w-4 h-4 mr-2" />
          Mark as graduated
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark students as graduated</DialogTitle>
          <DialogDescription>
            Only the checked students below will be marked graduated. They
            immediately lose sign-in access; historical data (plots, growth
            logs, alerts) stays intact and this can be undone later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="graduation-date" className="text-xs">
            Graduation date
          </Label>
          <input
            id="graduation-date"
            type="date"
            value={graduationDate}
            onChange={(e) => setGraduationDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
          {students.map((s) => {
            const warning = graduationYearWarning(s.course, s.yearLevel);
            return (
              <label
                key={s.id}
                className="flex items-start gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={checked.has(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="ml-1 text-xs text-gray-500">
                    {[s.idNumber, s.course, s.yearLevel, s.section]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {warning && (
                    <span className="block text-xs text-amber-600 mt-0.5">
                      {warning}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {warnedCheckedCount > 0 && (
          <p className="text-xs text-amber-600">
            {warnedCheckedCount} selected student{warnedCheckedCount === 1 ? "" : "s"} may
            not be graduating yet.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || checked.size === 0}>
            {submitting
              ? "Marking..."
              : `Mark ${checked.size} of ${students.length} students as graduated`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
