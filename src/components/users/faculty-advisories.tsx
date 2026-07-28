"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setFacultyAdvisories } from "@/actions/advisories";
import { SECTION_REGEX } from "@/lib/constants/user-import";

const SECTION_OPTIONS_LIST_ID = "faculty-advisory-section-options";

export function FacultyAdvisories({
  facultyId,
  initialSections,
  allSections,
  canManageAdvisories,
}: {
  facultyId: string;
  initialSections: string[];
  allSections: string[];
  canManageAdvisories: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<string[]>(initialSections);
  const [draft, setDraft] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Two-step guard for clearing a previously non-empty list — set once the
  // user has clicked Save on an empty draft and needs to click again to
  // actually confirm. Reset on any further edit to the draft.
  const [confirmClearing, setConfirmClearing] = useState(false);

  function openDialog() {
    setPending(sections);
    setDraft("");
    setInlineError(null);
    setConfirmClearing(false);
    setDialogOpen(true);
  }

  function addSection() {
    const value = draft.trim().toUpperCase();
    if (!value) return;

    // Client-side check is UX only (fast feedback) — the server
    // re-validates against the exact same SECTION_REGEX regardless.
    if (!SECTION_REGEX.test(value)) {
      setInlineError(
        "Invalid section format. Expected e.g. BSA-4A (BSA, BTVTED, or BSABE + year 1-4 + letter)."
      );
      return;
    }

    if (pending.includes(value)) {
      // Reject duplicates silently — not a validation error.
      setDraft("");
      setInlineError(null);
      return;
    }

    setPending((prev) => [...prev, value]);
    setDraft("");
    setInlineError(null);
    setConfirmClearing(false);
  }

  function removeSection(value: string) {
    setPending((prev) => prev.filter((s) => s !== value));
    setConfirmClearing(false);
  }

  const hadSections = sections.length > 0;
  const isEmptyDraft = pending.length === 0;
  // Nothing to clear and nothing to add — saving would be a pure no-op.
  const saveDisabled = submitting || (isEmptyDraft && !hadSections);
  // Draft would wipe out a previously non-empty list — require a second,
  // explicit click before it actually happens.
  const showConfirmStep = isEmptyDraft && hadSections;

  async function handleSave() {
    if (showConfirmStep && !confirmClearing) {
      setConfirmClearing(true);
      return;
    }

    setSubmitting(true);
    const result = await setFacultyAdvisories(facultyId, pending);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Advised sections updated");
    setSections(pending);
    setDialogOpen(false);
    setConfirmClearing(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Advised sections</h3>
          <p className="text-xs text-muted-foreground">
            {sections.length === 0
              ? "No advised sections yet."
              : `${sections.length} section${sections.length === 1 ? "" : "s"} advised.`}
          </p>
        </div>
        {canManageAdvisories && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openDialog();
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit sections
              </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>Edit advised sections</DialogTitle>
                <DialogDescription>
                  Sections this faculty member advises. Replaces the full list on save.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="section-input">Add section</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="section-input"
                      list={SECTION_OPTIONS_LIST_ID}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setInlineError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSection();
                        }
                      }}
                      placeholder="e.g. BSA-1A"
                    />
                    <datalist id={SECTION_OPTIONS_LIST_ID}>
                      {allSections.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <Button type="button" variant="outline" onClick={addSection}>
                      Add
                    </Button>
                  </div>
                  {inlineError && (
                    <p className="text-xs text-destructive mt-1">{inlineError}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 min-h-8">
                  {pending.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No sections added.</p>
                  ) : (
                    pending.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-1">
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSection(s)}
                          aria-label={`Remove ${s}`}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" onClick={handleSave} disabled={saveDisabled}>
                  {submitting
                    ? "Saving..."
                    : showConfirmStep
                    ? "Confirm: remove all sections"
                    : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
