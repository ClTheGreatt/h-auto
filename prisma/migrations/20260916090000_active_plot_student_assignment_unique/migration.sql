-- Stop for human review if existing ACTIVE rows would violate the new rule.
-- Historical COMPLETED/CANCELLED rows are deliberately outside this index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PlotAssignment"
    WHERE "status" = 'ACTIVE'
    GROUP BY "plotId", "studentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate ACTIVE PlotAssignment plotId/studentId pairs exist; review them before applying this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "PlotAssignment_active_plot_student_unique"
ON "PlotAssignment" ("plotId", "studentId")
WHERE "status" = 'ACTIVE';
