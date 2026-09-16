import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEPARTMENT_ADVISORY_CONFLICT_ERROR,
  INVALID_RESULTING_FACULTY_DEPARTMENT_ERROR,
  MISSING_FACULTY_DEPARTMENT_ERROR,
  REVIEW_SECTION_CONFLICT_ERROR,
  UNRESOLVED_ADVISORY_CONFLICT_ERROR,
  advisorySavePlan,
  academicCohortKey,
  isAdvisoryResolvedForDepartment,
  isCanonicalAcademicProgram,
  isFacultyCourseCompatible,
  missingRequestedCohort,
  normalizeRequestedCohorts,
  requestedCohortError,
  resolvedAdvisoriesForDepartment,
  resultingFacultyAdvisoryError,
  resultingUserAcademicState,
  reviewRemovalError,
  reviewSectionConflictError,
} from "./cohort-integrity";

const BTVTED_ANIMAL = "BTVTEd - Animal Production";
const BSA_CROP = "BS Agriculture - Crop Science";
const BSA_ANIMAL = "BS Agriculture - Animal Science";

test("canonical academic programs are shared exact values", () => {
  assert.equal(isCanonicalAcademicProgram(BTVTED_ANIMAL), true);
  assert.equal(isCanonicalAcademicProgram("BTVTED"), false);
  assert.equal(isCanonicalAcademicProgram(` ${BTVTED_ANIMAL}`), false);
});

test("Faculty Department compatibility is exact canonical equality", () => {
  assert.equal(isFacultyCourseCompatible(BTVTED_ANIMAL, BTVTED_ANIMAL), true);
  assert.equal(isFacultyCourseCompatible(BTVTED_ANIMAL, BSA_CROP), false);
  assert.equal(isFacultyCourseCompatible(null, BTVTED_ANIMAL), false);
});

test("valid compatible cohort passes advisory validation", () => {
  assert.equal(
    requestedCohortError(BTVTED_ANIMAL, {
      course: BTVTED_ANIMAL,
      section: "BTVTED-2B",
    }),
    null
  );
});

test("both production mismatch shapes fail advisory validation", () => {
  assert.match(
    requestedCohortError(BTVTED_ANIMAL, {
      course: BSA_CROP,
      section: "BSA-3D",
    })!,
    /does not match/
  );
  assert.match(
    requestedCohortError(BTVTED_ANIMAL, {
      course: BSA_ANIMAL,
      section: "BSA-4D",
    })!,
    /does not match/
  );
});

test("missing and noncanonical Faculty departments block cohort saves", () => {
  const cohort = { course: BTVTED_ANIMAL, section: "BTVTED-2B" };
  assert.equal(requestedCohortError(null, cohort), MISSING_FACULTY_DEPARTMENT_ERROR);
  assert.equal(
    requestedCohortError("Unlisted program", cohort),
    MISSING_FACULTY_DEPARTMENT_ERROR
  );
});

test("invalid or arbitrary section text cannot pass validation", () => {
  assert.equal(
    requestedCohortError(BTVTED_ANIMAL, {
      course: BTVTED_ANIMAL,
      section: "arbitrary section",
    }),
    "Select a valid Section."
  );
});

test("requested cohorts normalize sections and deduplicate exact identities", () => {
  const normalized = normalizeRequestedCohorts([
    { course: BTVTED_ANIMAL, section: " btvted-2b " },
    { course: BTVTED_ANIMAL, section: "BTVTED-2B" },
  ]);
  assert.deepEqual(normalized, [
    { course: BTVTED_ANIMAL, section: "BTVTED-2B" },
  ]);
  assert.equal(
    academicCohortKey(normalized[0] as { course: typeof BTVTED_ANIMAL; section: string }),
    JSON.stringify([BTVTED_ANIMAL, "BTVTED-2B"])
  );
});

test("requested cohort must exist as an exact Course and Section pair", () => {
  const available = [
    { course: BTVTED_ANIMAL, section: "BTVTED-2B" },
    { course: BSA_CROP, section: "BSA-3D" },
  ];
  assert.equal(
    missingRequestedCohort(
      [{ course: BTVTED_ANIMAL, section: "BTVTED-2B" }],
      available
    ),
    null
  );
  assert.deepEqual(
    missingRequestedCohort(
      [{ course: BTVTED_ANIMAL, section: "BSA-3D" }],
      available
    ),
    { course: BTVTED_ANIMAL, section: "BSA-3D" }
  );
});

test("resulting academic state uses the requested role and preserves an omitted department", () => {
  assert.deepEqual(
    resultingUserAcademicState(
      { role: "STUDENT_FARMER", department: BSA_CROP },
      { role: "FACULTY" }
    ),
    { role: "FACULTY", department: BSA_CROP }
  );
  assert.deepEqual(
    resultingUserAcademicState(
      { role: "FACULTY", department: BSA_CROP },
      { role: "FACULTY", department: BTVTED_ANIMAL }
    ),
    { role: "FACULTY", department: BTVTED_ANIMAL }
  );
});

test("Faculty with compatible advisories and the same department allows unrelated edits", () => {
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", BTVTED_ANIMAL, [
      { course: BTVTED_ANIMAL },
    ]),
    null
  );
});

test("Faculty department change is blocked by an incompatible resolved advisory", () => {
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", BTVTED_ANIMAL, [
      { course: BSA_CROP },
    ]),
    DEPARTMENT_ADVISORY_CONFLICT_ERROR
  );
});

test("Faculty department change is blocked by an unresolved advisory", () => {
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", BTVTED_ANIMAL, [
      { course: null },
    ]),
    UNRESOLVED_ADVISORY_CONFLICT_ERROR
  );
});

test("non-Faculty promotion with an incompatible retained advisory is blocked", () => {
  const resulting = resultingUserAcademicState(
    { role: "STUDENT_FARMER", department: BSA_CROP },
    { role: "FACULTY", department: BTVTED_ANIMAL }
  );
  assert.equal(
    resultingFacultyAdvisoryError(resulting.role, resulting.department, [
      { course: BSA_CROP },
    ]),
    DEPARTMENT_ADVISORY_CONFLICT_ERROR
  );
});

test("non-Faculty promotion with an unresolved retained advisory is blocked", () => {
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", BTVTED_ANIMAL, [
      { course: null },
    ]),
    UNRESOLVED_ADVISORY_CONFLICT_ERROR
  );
});

test("non-Faculty promotion with compatible retained advisories is allowed", () => {
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", BTVTED_ANIMAL, [
      { course: BTVTED_ANIMAL },
    ]),
    null
  );
});

test("promotion to Faculty without a canonical department is blocked", () => {
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", null, []),
    INVALID_RESULTING_FACULTY_DEPARTMENT_ERROR
  );
  assert.equal(
    resultingFacultyAdvisoryError("FACULTY", "Unknown", []),
    INVALID_RESULTING_FACULTY_DEPARTMENT_ERROR
  );
});

test("changing away from Faculty does not require or reinterpret advisories", () => {
  assert.equal(
    resultingFacultyAdvisoryError("STUDENT_FARMER", null, [
      { course: null },
      { course: BSA_CROP },
    ]),
    null
  );
});

test("only matching non-null Course is resolved for the current department", () => {
  const advisories = [
    { id: "legacy-3d", course: null, section: "BSA-3D" },
    { id: "mismatch", course: BSA_CROP, section: "BSA-3D" },
    {
      id: "resolved",
      course: BTVTED_ANIMAL,
      section: "BTVTED-2B",
    },
  ];
  assert.equal(
    isAdvisoryResolvedForDepartment(BTVTED_ANIMAL, advisories[2]),
    true
  );
  assert.equal(
    isAdvisoryResolvedForDepartment(BTVTED_ANIMAL, advisories[0]),
    false
  );
  assert.equal(
    isAdvisoryResolvedForDepartment(BTVTED_ANIMAL, advisories[1]),
    false
  );
  assert.equal(
    isAdvisoryResolvedForDepartment(null, advisories[2]),
    false
  );
  assert.deepEqual(
    resolvedAdvisoriesForDepartment(BTVTED_ANIMAL, advisories).map(
      (advisory) => advisory.id
    ),
    ["resolved"]
  );
});

test("review removal requires ownership of every requested ID", () => {
  assert.equal(reviewRemovalError(["review-a"], ["review-a"]), null);
  assert.equal(
    reviewRemovalError(["review-a", "other-faculty-row"], ["review-a"]),
    "One or more advisories needing review cannot be removed."
  );
  assert.equal(
    reviewRemovalError(["resolved-row"], []),
    "One or more advisories needing review cannot be removed."
  );
});

test("saving resolved cohorts preserves null and incompatible review rows", () => {
  const plan = advisorySavePlan(
    [
      { id: "legacy-3d", course: null, section: "BSA-3D" },
      { id: "mismatch-4d", course: BSA_ANIMAL, section: "BSA-4D" },
      {
        id: "resolved-old",
        course: BTVTED_ANIMAL,
        section: "BTVTED-1A",
      },
    ],
    BTVTED_ANIMAL,
    []
  );
  assert.deepEqual(plan, {
    resolvedIdsToReplace: ["resolved-old"],
    reviewIdsToRemove: [],
    reviewRowsToKeep: [
      { id: "legacy-3d", course: null, section: "BSA-3D" },
      { id: "mismatch-4d", course: BSA_ANIMAL, section: "BSA-4D" },
    ],
  });
});

test("explicit review removal removes only the owned selected row", () => {
  assert.deepEqual(
    advisorySavePlan(
      [
        { id: "legacy-3d", course: null, section: "BSA-3D" },
        { id: "mismatch-4d", course: BSA_ANIMAL, section: "BSA-4D" },
      ],
      BTVTED_ANIMAL,
      ["legacy-3d"]
    ),
    {
      resolvedIdsToReplace: [],
      reviewIdsToRemove: ["legacy-3d"],
      reviewRowsToKeep: [
        { id: "mismatch-4d", course: BSA_ANIMAL, section: "BSA-4D" },
      ],
    }
  );
});

test("Phase A requires same-Section review rows to be removed before resolution", () => {
  assert.equal(
    reviewSectionConflictError(
      [{ section: "BTVTED-2B" }],
      [{ section: "BTVTED-2B" }]
    ),
    REVIEW_SECTION_CONFLICT_ERROR
  );
  assert.equal(
    reviewSectionConflictError(
      [{ section: "BTVTED-2B" }],
      [{ section: "BSA-3D" }]
    ),
    null
  );
});
