BEGIN;

LOCK TABLE "Alert" IN SHARE ROW EXCLUSIVE MODE;

WITH ranked_open_alerts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "plotId", "type"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "Alert"
  WHERE "resolved" = false
)
UPDATE "Alert"
SET
  "resolved" = true,
  "resolvedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  SELECT "id"
  FROM ranked_open_alerts
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "Alert_one_open_per_plot_type_key"
ON "Alert" ("plotId", "type")
WHERE "resolved" = false;

COMMIT;
