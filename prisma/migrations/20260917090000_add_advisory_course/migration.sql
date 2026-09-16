-- Existing rows deliberately remain unresolved with course = NULL.
-- Course cannot be inferred safely from section prefixes.
-- Phase A is additive only so the old and new applications can coexist.
-- Final course-aware indexes belong to a later release after app cutover.
ALTER TABLE "FacultySectionAdvisory"
ADD COLUMN "course" TEXT;
