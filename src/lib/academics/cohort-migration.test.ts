import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const sql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260917090000_add_advisory_course",
    "migration.sql"
  ),
  "utf8"
);

test("advisory migration adds nullable Course without a backfill", () => {
  assert.match(sql, /ADD COLUMN "course" TEXT;/);
  assert.doesNotMatch(sql, /NOT NULL/i);
  assert.doesNotMatch(sql, /\bUPDATE\b/i);
});

test("Phase A preserves the old section-only uniqueness and index", () => {
  assert.doesNotMatch(
    sql,
    /DROP INDEX "FacultySectionAdvisory_facultyId_section_key"/
  );
  assert.doesNotMatch(
    sql,
    /DROP INDEX "FacultySectionAdvisory_section_idx"/
  );
});

test("Phase A does not deploy final cohort indexes prematurely", () => {
  assert.doesNotMatch(
    sql,
    /FacultySectionAdvisory_facultyId_course_section_key/
  );
  assert.doesNotMatch(
    sql,
    /FacultySectionAdvisory_course_section_idx/
  );
});

test("advisory migration does not mutate User or PlotAssignment data", () => {
  assert.doesNotMatch(sql, /ALTER TABLE "User"/);
  assert.doesNotMatch(sql, /ALTER TABLE "PlotAssignment"/);
  assert.doesNotMatch(sql, /DELETE FROM/i);
});
