import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

const assignments = source("src", "actions", "assignments.ts");
const assignmentIntegrity = source(
  "src",
  "lib",
  "assignments",
  "assignment-integrity.ts"
);
const assignStudentBody = assignments.slice(
  assignments.indexOf("export async function assignStudent"),
  assignments.indexOf("export async function removeAssignment")
);
const candidateBody = assignments.slice(
  assignments.indexOf("export async function getAssignableStudentsForPlot"),
  assignments.indexOf("async function validateSectionTarget")
);
const bulkBody = assignments.slice(
  assignments.indexOf("async function validateSectionTarget")
);

test("individual assignment delegates final state to shared transactional validation", () => {
  assert.match(
    assignStudentBody,
    /runAssignmentTransaction\(async \(tx\)[\s\S]*?validateFinalAssignment\([\s\S]*?plotId,[\s\S]*?studentId,[\s\S]*?tx/
  );
  assert.match(assignStudentBody, /facultyId: validation\.plot\.facultyId/);
  assert.match(assignStudentBody, /assignedById: session\.user\.id/);
});

test("candidate lookup checks actor and target adviser for the requested cohort", () => {
  assert.match(
    candidateBody,
    /validateAssignmentCohortAuthorities\([\s\S]*?plotFacultyId: plot\.facultyId![\s\S]*?course: target\.course,[\s\S]*?section: target\.section/
  );
  assert.match(candidateBody, /targetAdviserAuthorized/);
});

test("bulk preview uses the shared exact target validator", () => {
  assert.match(
    bulkBody,
    /getSectionAssignmentPreview[\s\S]*?validateSectionTarget\([\s\S]*?target,[\s\S]*?prisma/
  );
});

test("bulk submit rechecks the exact target inside the serializable transaction", () => {
  assert.match(
    bulkBody,
    /assignSectionToPlot[\s\S]*?runAssignmentTransaction\(async \(tx\)[\s\S]*?validateSectionTarget\(target, actor, tx\)/
  );
  assert.match(bulkBody, /targetAdviserAuthorized/);
  assert.match(
    assignmentIntegrity,
    /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/
  );
  assert.match(assignmentIntegrity, /error\.code !== "P2034"/);
});

test("Assignments and Plot Detail use the shared actor-scoped cohort source", () => {
  const assignmentsPage = source(
    "src",
    "app",
    "dashboard",
    "assignments",
    "page.tsx"
  );
  const plotDetailPage = source(
    "src",
    "app",
    "dashboard",
    "plots",
    "[id]",
    "page.tsx"
  );
  assert.match(assignmentsPage, /getAssignableStudentCohorts\(actor\)/);
  assert.match(plotDetailPage, /getAssignableStudentCohorts\(\{ role, userId:/);
});

test("mobile assignment uses shared final validation and candidates use shared scope", () => {
  const mobileAssignment = source(
    "src",
    "app",
    "api",
    "mobile",
    "me",
    "plots",
    "[id]",
    "assignments",
    "route.ts"
  );
  const mobileCandidates = source(
    "src",
    "app",
    "api",
    "mobile",
    "me",
    "plots",
    "[id]",
    "assignable-students",
    "route.ts"
  );
  assert.match(
    mobileAssignment,
    /runAssignmentTransaction\(async \(tx\)[\s\S]*?validateFinalAssignment\([\s\S]*?plotId,[\s\S]*?studentId,[\s\S]*?tx/
  );
  assert.match(mobileAssignment, /facultyId: validation\.plot\.facultyId/);
  assert.match(mobileAssignment, /assignedById: user\.id/);
  assert.match(mobileCandidates, /buildAssignableStudentsWhere\(\{/);
});

test("legacy advisory presentation stays visible and explicitly reviewable", () => {
  const component = source(
    "src",
    "components",
    "users",
    "faculty-advisories.tsx"
  );
  assert.match(component, /Course not recorded/);
  assert.match(component, /Needs review/);
  assert.match(component, /isAdvisoryResolvedForDepartment\(department, advisory\)/);
  assert.match(component, /removeReviewIds/);
  assert.match(component, /advisory\.course \?\? "Course not recorded"/);
});

test("user updates validate the resulting Faculty role without deleting advisories", () => {
  const usersAction = source("src", "actions", "users.ts");
  assert.match(
    usersAction,
    /resultingUserAcademicState\(\s*authoritativeUser,/
  );
  assert.match(
    usersAction,
    /if \(authoritativeAcademicState\.role === "FACULTY"\)/
  );
  assert.match(usersAction, /tx\.facultySectionAdvisory\.findMany/);
  assert.match(usersAction, /resultingFacultyAdvisoryError\(/);
  assert.doesNotMatch(usersAction, /facultySectionAdvisory\.delete/);
});

test("section-only Faculty authorization helper is absent", () => {
  const authorizationSources = [
    source("src", "lib", "auth", "section-access.ts"),
    assignments,
    source(
      "src",
      "app",
      "api",
      "mobile",
      "me",
      "plots",
      "[id]",
      "assignments",
      "route.ts"
    ),
  ].join("\n");
  assert.doesNotMatch(authorizationSources, /canFacultyAdviseSection/);
});
