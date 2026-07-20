-- Tracks when a plot was archived. Nullable: null for plots that have
-- never been archived; set by archivePlot, cleared by restorePlot.
ALTER TABLE "Plot" ADD COLUMN "archivedAt" TIMESTAMP(3);
