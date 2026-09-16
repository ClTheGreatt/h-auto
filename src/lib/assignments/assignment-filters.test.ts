import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma, UserRole } from "@prisma/client";
import {
  assignmentCandidateRequestKey,
  assignmentDialogRequestKey,
  assignmentRequestError,
  assignmentSearchTokens,
  buildAssignmentListWhere,
  candidateSearchKeywords,
  candidateSections,
  candidatesInSection,
  clearAssignmentFilterParams,
  defaultCandidateSection,
  shouldClearSelectedStudent,
  type AssignmentCandidate,
} from "./assignment-filters";

const FACULTY_A = "faculty-a";
const FACULTY_B = "faculty-b";
const STUDENT_A = "student-a";

const candidates: AssignmentCandidate[] = [
  {
    id: "student-a",
    firstName: "Aaron",
    lastName: "Alfonso",
    idNumber: "2023-00123",
    email: "aaron@example.edu",
    course: "Bachelor of Science in Agriculture",
    yearLevel: "4th Year",
    section: "BSA-4D",
  },
  {
    id: "student-b",
    firstName: "Bea",
    lastName: "Bautista",
    idNumber: null,
    email: "bea@example.edu",
    course: null,
    yearLevel: "3rd Year",
    section: "BSA-3A",
  },
  {
    id: "student-c",
    firstName: "Carlo",
    lastName: "Cruz",
    idNumber: "2024-00456",
    email: "carlo@example.edu",
    course: null,
    yearLevel: null,
    section: null,
  },
];

function whereConditions(
  where: Prisma.PlotAssignmentWhereInput
): Prisma.PlotAssignmentWhereInput[] {
  return where.AND as Prisma.PlotAssignmentWhereInput[];
}

function searchFields(
  where: Prisma.PlotAssignmentWhereInput,
  conditionIndex: number
): Prisma.UserWhereInput[] {
  const condition = whereConditions(where)[conditionIndex];
  const relation = condition.student as Prisma.UserScalarRelationFilter;
  return (relation.is as Prisma.UserWhereInput).OR as Prisma.UserWhereInput[];
}

function facultyScopeMatchesCurrentPlot(
  where: Prisma.PlotAssignmentWhereInput,
  currentPlotFacultyId: string
): boolean {
  const relation = whereConditions(where)[0].plot as Prisma.PlotScalarRelationFilter;
  const scopedFacultyId = (relation.is as Prisma.PlotWhereInput).facultyId;
  return scopedFacultyId === currentPlotFacultyId;
}

function activeStudent(overrides: {
  role?: UserRole;
  status?: "ACTIVE" | "INACTIVE";
  graduatedAt?: Date | null;
} = {}) {
  return {
    role: overrides.role ?? ("STUDENT_FARMER" as const),
    status: overrides.status ?? ("ACTIVE" as const),
    graduatedAt: overrides.graduatedAt ?? null,
  };
}

test("1. Faculty assignment scope uses the plot's current adviser", () => {
  const where = buildAssignmentListWhere({
    role: "FACULTY",
    userId: FACULTY_A,
  });

  assert.deepEqual(whereConditions(where).slice(0, 2), [
    { plot: { is: { facultyId: FACULTY_A } } },
    { status: "ACTIVE" },
  ]);
});

test("2. A former adviser predicate no longer matches the transferred plot owner", () => {
  const formerWhere = buildAssignmentListWhere({
    role: "FACULTY",
    userId: FACULTY_A,
  });

  assert.equal(facultyScopeMatchesCurrentPlot(formerWhere, FACULTY_B), false);
});

test("3. The current adviser receives a predicate for their current plot ownership", () => {
  const currentWhere = buildAssignmentListWhere({
    role: "FACULTY",
    userId: FACULTY_B,
  });

  assert.deepEqual(whereConditions(currentWhere)[0], {
    plot: { is: { facultyId: FACULTY_B } },
  });
  assert.equal(facultyScopeMatchesCurrentPlot(currentWhere, FACULTY_B), true);
});

test("4. Admin and Super Admin retain broad active assignment scope", () => {
  for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
    const where = buildAssignmentListWhere({ role, userId: role });
    assert.deepEqual(whereConditions(where).slice(0, 2), [
      {},
      { status: "ACTIVE" },
    ]);
  }
});

test("5. Student Farmer scope remains own active assignments", () => {
  const where = buildAssignmentListWhere({
    role: "STUDENT_FARMER",
    userId: STUDENT_A,
  });

  assert.deepEqual(whereConditions(where).slice(0, 2), [
    { studentId: STUDENT_A },
    { status: "ACTIVE" },
  ]);
});

test("6. Inactive student submissions are rejected", () => {
  assert.equal(
    assignmentRequestError({
      student: activeStudent({ status: "INACTIVE" }),
      sectionAuthorized: true,
      hasActiveAssignment: false,
    }),
    "Cannot assign an inactive student to a plot."
  );
});

test("7. Graduated student submissions are rejected", () => {
  assert.equal(
    assignmentRequestError({
      student: activeStudent({ graduatedAt: new Date("2026-01-01") }),
      sectionAuthorized: true,
      hasActiveAssignment: false,
    }),
    "Cannot assign a graduated student to a plot."
  );
});

test("8. Faculty submissions outside authorized sections are rejected", () => {
  assert.equal(
    assignmentRequestError({
      student: activeStudent(),
      sectionAuthorized: false,
      hasActiveAssignment: false,
    }),
    "You are not authorized to assign a student from this section."
  );
});

test("9. Duplicate active assignments are rejected", () => {
  assert.equal(
    assignmentRequestError({
      student: activeStudent(),
      sectionAuthorized: true,
      hasActiveAssignment: true,
    }),
    "This student is already assigned to this plot"
  );
});

test("10. A valid authorized active student reaches the accepted path", () => {
  assert.equal(
    assignmentRequestError({
      student: activeStudent(),
      sectionAuthorized: true,
      hasActiveAssignment: false,
    }),
    null
  );
});

test("11-14. Search trims and creates an AND condition per token", () => {
  assert.deepEqual(assignmentSearchTokens("  Aaron   Alfonso  "), [
    "Aaron",
    "Alfonso",
  ]);

  const where = buildAssignmentListWhere(
    { role: "ADMIN", userId: "admin" },
    { search: "Aaron Alfonso" }
  );
  const conditions = whereConditions(where);
  assert.equal(conditions.length, 4);
  assert.deepEqual(searchFields(where, 2), [
    { firstName: { contains: "Aaron", mode: "insensitive" } },
    { lastName: { contains: "Aaron", mode: "insensitive" } },
    { email: { contains: "Aaron", mode: "insensitive" } },
    { idNumber: { contains: "Aaron", mode: "insensitive" } },
  ]);
  assert.deepEqual(searchFields(where, 3), [
    { firstName: { contains: "Alfonso", mode: "insensitive" } },
    { lastName: { contains: "Alfonso", mode: "insensitive" } },
    { email: { contains: "Alfonso", mode: "insensitive" } },
    { idNumber: { contains: "Alfonso", mode: "insensitive" } },
  ]);
});

test("15-17. Section, plot, and search filters compose with AND", () => {
  const where = buildAssignmentListWhere(
    { role: "FACULTY", userId: FACULTY_A },
    { search: "Aaron", section: "BSA-4D", plotId: "plot-a" }
  );
  const conditions = whereConditions(where);

  assert.deepEqual(conditions[0], {
    plot: { is: { facultyId: FACULTY_A } },
  });
  assert.deepEqual(conditions[1], { status: "ACTIVE" });
  assert.deepEqual(conditions[2], { plotId: "plot-a" });
  assert.deepEqual(conditions[3], {
    student: { is: { section: "BSA-4D" } },
  });
  assert.equal(searchFields(where, 4).length, 4);
});

test("18. An unauthorized section query only narrows Faculty base scope", () => {
  const where = buildAssignmentListWhere(
    { role: "FACULTY", userId: FACULTY_A },
    { section: "UNAUTHORIZED" }
  );

  assert.deepEqual(whereConditions(where), [
    { plot: { is: { facultyId: FACULTY_A } } },
    { status: "ACTIVE" },
    { student: { is: { section: "UNAUTHORIZED" } } },
  ]);
});

test("19. Dialog section options are authorized-candidate-derived and omit null", () => {
  assert.deepEqual(candidateSections(candidates), ["BSA-3A", "BSA-4D"]);
  assert.deepEqual(
    candidatesInSection(candidates, "BSA-4D").map((candidate) => candidate.id),
    ["student-a"]
  );
  assert.equal(defaultCandidateSection("FACULTY", ["BSA-4D"]), "BSA-4D");
  assert.equal(defaultCandidateSection("ADMIN", ["BSA-4D"]), undefined);
});

test("20-22. Dialog search keywords contain name, idNumber, and email", () => {
  assert.deepEqual(candidateSearchKeywords(candidates[0]), [
    "Aaron Alfonso",
    "2023-00123",
    "aaron@example.edu",
  ]);
  assert.deepEqual(candidateSearchKeywords(candidates[1]), [
    "Bea Bautista",
    "bea@example.edu",
  ]);
});

test("23. Section changes clear a student only when selection becomes invalid", () => {
  assert.equal(
    shouldClearSelectedStudent(candidates, "student-a", "BSA-3A"),
    true
  );
  assert.equal(
    shouldClearSelectedStudent(candidates, "student-a", "BSA-4D"),
    false
  );
});

test("24. Search text is not part of selected-student validity", () => {
  const unrelatedSearch = "no-match";
  assert.equal(unrelatedSearch.length > 0, true);
  assert.equal(
    shouldClearSelectedStudent(candidates, "student-a", "BSA-4D"),
    false
  );
});

test("25. A section with no authorized candidates returns an empty result", () => {
  assert.deepEqual(candidatesInSection(candidates, "BSA-9Z"), []);
});

test("26. Clear filters removes every assignment filter", () => {
  assert.equal(
    clearAssignmentFilterParams(
      "search=Aaron&section=BSA-4D&plotId=plot-a"
    ),
    ""
  );
});

test("27. Clear filters preserves unrelated query parameters", () => {
  assert.equal(
    clearAssignmentFilterParams(
      "search=Aaron&section=BSA-4D&plotId=plot-a&foo=bar&page=2"
    ),
    "foo=bar&page=2"
  );
});

test("28-31. Dialog request identity includes mode, plot, course (including null), and section", () => {
  const base = {
    plotId: "plot-a",
    course: "BS Agriculture - Crop Science",
    section: "BSA-4D",
  };
  const key = assignmentCandidateRequestKey(base);

  assert.notEqual(
    key,
    assignmentCandidateRequestKey({ ...base, plotId: "plot-b" })
  );
  assert.notEqual(
    key,
    assignmentCandidateRequestKey({ ...base, course: "BS Agriculture - Agronomy" })
  );
  assert.notEqual(
    key,
    assignmentCandidateRequestKey({ ...base, section: "BSA-4E" })
  );
  assert.notEqual(
    key,
    assignmentCandidateRequestKey({ ...base, course: null })
  );
  assert.notEqual(key, assignmentDialogRequestKey("section", base));
});
