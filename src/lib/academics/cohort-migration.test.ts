import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const phaseASql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260917090000_add_advisory_course",
    "migration.sql"
  ),
  "utf8"
);

const phaseBSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260917100000_finalize_advisory_cohort_identity",
    "migration.sql"
  ),
  "utf8"
);

test("advisory migration adds nullable Course without a backfill", () => {
  assert.match(phaseASql, /ADD COLUMN "course" TEXT;/);
  assert.doesNotMatch(phaseASql, /NOT NULL/i);
  assert.doesNotMatch(phaseASql, /\bUPDATE\b/i);
});

test("Phase A preserves the old section-only uniqueness and index", () => {
  assert.doesNotMatch(
    phaseASql,
    /DROP INDEX "FacultySectionAdvisory_facultyId_section_key"/
  );
  assert.doesNotMatch(
    phaseASql,
    /DROP INDEX "FacultySectionAdvisory_section_idx"/
  );
});

test("Phase A does not deploy final cohort indexes prematurely", () => {
  assert.doesNotMatch(
    phaseASql,
    /FacultySectionAdvisory_facultyId_course_section_key/
  );
  assert.doesNotMatch(
    phaseASql,
    /FacultySectionAdvisory_course_section_idx/
  );
});

test("advisory migration does not mutate User or PlotAssignment data", () => {
  assert.doesNotMatch(phaseASql, /ALTER TABLE "User"/);
  assert.doesNotMatch(phaseASql, /ALTER TABLE "PlotAssignment"/);
  assert.doesNotMatch(phaseASql, /DELETE FROM/i);
});

test("Phase B creates the exact Faculty, Course, and Section unique index", () => {
  assert.match(
    phaseBSql,
    /CREATE UNIQUE INDEX "FacultySectionAdvisory_facultyId_course_section_key"[\s\S]*?ON "FacultySectionAdvisory"\("facultyId", "course", "section"\);/
  );
});

test("Phase B creates the Course and Section lookup index", () => {
  assert.match(
    phaseBSql,
    /CREATE INDEX "FacultySectionAdvisory_course_section_idx"[\s\S]*?ON "FacultySectionAdvisory"\("course", "section"\);/
  );
});

test("Phase B creates new protection before dropping Phase A indexes", () => {
  const newUnique = phaseBSql.indexOf(
    'CREATE UNIQUE INDEX "FacultySectionAdvisory_facultyId_course_section_key"'
  );
  const newLookup = phaseBSql.indexOf(
    'CREATE INDEX "FacultySectionAdvisory_course_section_idx"'
  );
  const oldUnique = phaseBSql.indexOf(
    'DROP INDEX "FacultySectionAdvisory_facultyId_section_key"'
  );
  const oldLookup = phaseBSql.indexOf(
    'DROP INDEX "FacultySectionAdvisory_section_idx"'
  );

  assert.ok(newUnique >= 0);
  assert.ok(newUnique < newLookup);
  assert.ok(newLookup < oldUnique);
  assert.ok(oldUnique < oldLookup);
});

test("Phase B removes the old Faculty and Section unique index", () => {
  assert.match(
    phaseBSql,
    /DROP INDEX "FacultySectionAdvisory_facultyId_section_key";/
  );
});

test("Phase B removes the old Section lookup index", () => {
  assert.match(
    phaseBSql,
    /DROP INDEX "FacultySectionAdvisory_section_idx";/
  );
});

test("Phase B contains no UPDATE statements", () => {
  assert.doesNotMatch(phaseBSql, /\bUPDATE\b/i);
});

test("Phase B contains no DELETE statements", () => {
  assert.doesNotMatch(phaseBSql, /\bDELETE\b/i);
});

test("Phase B does not backfill advisory content or require a non-null column", () => {
  assert.doesNotMatch(phaseBSql, /\bINSERT\b/i);
  assert.doesNotMatch(phaseBSql, /ALTER COLUMN[\s\S]*?SET NOT NULL/i);
});

test("Phase B fails closed when unresolved NULL Course rows exist", () => {
  assert.match(
    phaseBSql,
    /IF EXISTS[\s\S]*?FROM "FacultySectionAdvisory"[\s\S]*?WHERE "course" IS NULL[\s\S]*?RAISE EXCEPTION/
  );
});

test("Phase B fails closed when exact resolved identities are duplicated", () => {
  assert.match(
    phaseBSql,
    /WHERE "course" IS NOT NULL[\s\S]*?GROUP BY "facultyId", "course", "section"[\s\S]*?HAVING COUNT\(\*\) > 1[\s\S]*?RAISE EXCEPTION/
  );
});

test("Phase B leaves the User table untouched", () => {
  assert.doesNotMatch(phaseBSql, /(?:ALTER|UPDATE|DELETE FROM)\s+"User"/i);
});

test("Phase B leaves the PlotAssignment table untouched", () => {
  assert.doesNotMatch(
    phaseBSql,
    /(?:ALTER|UPDATE|DELETE FROM)\s+"PlotAssignment"/i
  );
});
