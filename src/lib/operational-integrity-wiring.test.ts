import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

test("every production historical Plot re-entry path uses the shared transactional guard", () => {
  const actions = source("src", "actions", "plots.ts");
  const update = actions.slice(
    actions.indexOf("export async function updatePlot"),
    actions.indexOf("export async function archivePlot")
  );
  const restore = actions.slice(
    actions.indexOf("export async function restorePlot"),
    actions.indexOf("export async function harvestPlot")
  );
  const unharvest = actions.slice(
    actions.indexOf("export async function unharvestPlot")
  );

  assert.match(
    update,
    /runPlotAdviserTransaction\(async \(tx\)[\s\S]*?applyPlotUpdateWithAdviserIntegrity\([\s\S]*?resultingStatus: authoritativeNextStatus/
  );
  assert.match(
    restore,
    /runPlotAdviserTransaction\(async \(tx\)[\s\S]*?status !== "ARCHIVED"[\s\S]*?applyPlotActivityEntryWithIntegrity\([\s\S]*?resultingStatus: "PREPARING"/
  );
  assert.match(
    unharvest,
    /runPlotAdviserTransaction\(async \(tx\)[\s\S]*?status !== "HARVESTED"[\s\S]*?applyPlotActivityEntryWithIntegrity\([\s\S]*?resultingStatus: "GROWING"/
  );
});

test("updateUser applies cohort integrity before the existing lifecycle mutation", () => {
  const actions = source("src", "actions", "users.ts");
  const update = actions.slice(
    actions.indexOf("export async function updateUser"),
    actions.indexOf("export async function reactivateUser")
  );

  assert.match(
    update,
    /runStudentAssignmentLifecycleTransaction\(async \(tx\)[\s\S]*?course: true[\s\S]*?section: true[\s\S]*?applyUserUpdateWithStudentCohortIntegrity\([\s\S]*?applyUserUpdateWithStudentAssignmentLifecycle\(/
  );
  assert.match(
    update,
    /canonicalStudentCohortValues\(existingUser\)[\s\S]*?canonicalStudentCohortValues\(rest\)[\s\S]*?validateStudentAcademicUpdate\([\s\S]*?currentAcademicInput[\s\S]*?finalAcademicInput[\s\S]*?course: resultingCourse[\s\S]*?section: resultingSection[\s\S]*?next: \{[\s\S]*?course: resultingCourse[\s\S]*?section: resultingSection[\s\S]*?tx\.user\.update\([\s\S]*?\.\.\.updateData/
  );
});
