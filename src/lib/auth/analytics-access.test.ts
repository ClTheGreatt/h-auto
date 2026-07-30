import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, UserRole } from "@prisma/client";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";
import {
  assertCanAccessPlot,
  buildDirectPlotAccessWhere,
  findReadingHistoryPlot,
  isValidPlotId,
} from "@/lib/auth/plot-access";
import { resolveMobilePlotSelection } from "@/lib/analytics/mobile-plot-selection";
import { plotScopeFilter } from "@/lib/analytics/observations-by-date";
import {
  parseOptionalPlotIdPageValue,
  parseOptionalPlotIdSearchParams,
  parseOptionalPlotIdValues,
} from "@/lib/auth/plot-id";
import {
  buildReportPlotWhere,
  buildStudentActivityAssignmentWhere,
  buildStudentActivityGrowthLogWhere,
  buildStudentActivityStudentWhere,
} from "@/lib/reports/data-fetchers";

const ADMIN_ID = "admin";
const FACULTY_ID = "faculty-a";
const OTHER_FACULTY_ID = "faculty-b";
const STUDENT_ID = "student-a";
const PLOT_A = `c${"a".repeat(24)}`;
const PLOT_B = `c${"b".repeat(24)}`;
const ARCHIVED_PLOT = `c${"d".repeat(24)}`;

type FixturePlot = {
  id: string;
  facultyId: string | null;
  status?: string;
};

type FixtureAssignment = {
  plotId: string;
  studentId: string;
  status: "ACTIVE" | "INACTIVE";
  endedAt: Date | null;
};

type FixtureStudent = {
  id: string;
  status: "ACTIVE" | "INACTIVE";
  graduatedAt: Date | null;
};

function createPlotLookup({
  plots,
  assignments = [],
  students = [],
}: {
  plots: FixturePlot[];
  assignments?: FixtureAssignment[];
  students?: FixtureStudent[];
}) {
  return async (
    where: Prisma.PlotWhereInput
  ): Promise<{ id: string } | null> => {
    const [roleWhere, additionalWhere] = (
      where as { AND: Prisma.PlotWhereInput[] }
    ).AND;
    const requestedId = additionalWhere.id;
    const plot = plots.find((candidate) => candidate.id === requestedId);
    if (!plot) return null;

    const denyAllIdFilter = roleWhere.id;
    if (
      denyAllIdFilter &&
      typeof denyAllIdFilter === "object" &&
      "in" in denyAllIdFilter &&
      Array.isArray(denyAllIdFilter.in) &&
      denyAllIdFilter.in.length === 0
    ) {
      return null;
    }

    if (typeof roleWhere.facultyId === "string") {
      return plot.facultyId === roleWhere.facultyId ? { id: plot.id } : null;
    }

    if (roleWhere.assignments) {
      const assignmentFilter = (
        roleWhere.assignments as {
          some: {
            studentId: string;
            status: string;
            endedAt: null;
            student: {
              is: { status: string; graduatedAt: null };
            };
          };
        }
      ).some;
      const student = students.find(
        (candidate) => candidate.id === assignmentFilter.studentId
      );
      const assignment = assignments.find(
        (candidate) =>
          candidate.plotId === plot.id &&
          candidate.studentId === assignmentFilter.studentId &&
          candidate.status === assignmentFilter.status &&
          candidate.endedAt === assignmentFilter.endedAt
      );
      const currentStudent =
        student?.status === assignmentFilter.student.is.status &&
        student.graduatedAt === assignmentFilter.student.is.graduatedAt;
      return assignment && currentStudent ? { id: plot.id } : null;
    }

    return { id: plot.id };
  };
}

test("1. Admin receives an unrestricted plot predicate", () => {
  assert.deepEqual(
    buildAccessiblePlotWhere({ role: "ADMIN", userId: ADMIN_ID }),
    { AND: [{}, {}] }
  );
});

test("2. Super Admin receives an unrestricted plot predicate", () => {
  assert.deepEqual(
    buildAccessiblePlotWhere({ role: "SUPER_ADMIN", userId: ADMIN_ID }),
    { AND: [{}, {}] }
  );
});

test("3. Faculty predicate uses current Plot.facultyId", () => {
  assert.deepEqual(
    buildAccessiblePlotWhere({ role: "FACULTY", userId: FACULTY_ID }),
    { AND: [{ facultyId: FACULTY_ID }, {}] }
  );
});

test("4. Student predicate requires an ACTIVE assignment", () => {
  const where = buildAccessiblePlotWhere({
    role: "STUDENT_FARMER",
    userId: STUDENT_ID,
  });
  assert.equal(
    (
      (where.AND as Prisma.PlotWhereInput[])[0].assignments as {
        some: { status: string };
      }
    ).some.status,
    "ACTIVE"
  );
});

test("5. Student predicate requires endedAt null", () => {
  const where = buildReportPlotWhere("STUDENT_FARMER", STUDENT_ID);
  assert.equal(
    (
      (where.AND as Prisma.PlotWhereInput[])[0].assignments as {
        some: { endedAt: null };
      }
    ).some.endedAt,
    null
  );
});

test("6. Student predicate requires an active user", () => {
  const where = buildAccessiblePlotWhere({
    role: "STUDENT_FARMER",
    userId: STUDENT_ID,
  });
  assert.equal(
    (
      (where.AND as Prisma.PlotWhereInput[])[0].assignments as {
        some: { student: { is: { status: string } } };
      }
    ).some.student.is.status,
    "ACTIVE"
  );
});

test("7. Student predicate requires graduatedAt null", () => {
  const where = buildAccessiblePlotWhere({
    role: "STUDENT_FARMER",
    userId: STUDENT_ID,
  });
  assert.equal(
    (
      (where.AND as Prisma.PlotWhereInput[])[0].assignments as {
        some: { student: { is: { graduatedAt: null } } };
      }
    ).some.student.is.graduatedAt,
    null
  );
});

test("8. Ended ACTIVE assignment does not grant access", async () => {
  const allowed = await assertCanAccessPlot(
    "STUDENT_FARMER",
    STUDENT_ID,
    PLOT_A,
    createPlotLookup({
      plots: [{ id: PLOT_A, facultyId: FACULTY_ID }],
      assignments: [
        {
          plotId: PLOT_A,
          studentId: STUDENT_ID,
          status: "ACTIVE",
          endedAt: new Date(),
        },
      ],
      students: [
        { id: STUDENT_ID, status: "ACTIVE", graduatedAt: null },
      ],
    })
  );
  assert.equal(allowed, false);
});

test("9. Faculty own plot is allowed", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "FACULTY",
      FACULTY_ID,
      PLOT_A,
      createPlotLookup({
        plots: [{ id: PLOT_A, facultyId: FACULTY_ID }],
      })
    ),
    true
  );
});

test("10. Faculty other Faculty's plot is denied", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "FACULTY",
      FACULTY_ID,
      PLOT_B,
      createPlotLookup({
        plots: [{ id: PLOT_B, facultyId: OTHER_FACULTY_ID }],
      })
    ),
    false
  );
});

test("11. Student current assigned plot is allowed", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "STUDENT_FARMER",
      STUDENT_ID,
      PLOT_A,
      createPlotLookup({
        plots: [{ id: PLOT_A, facultyId: FACULTY_ID }],
        assignments: [
          {
            plotId: PLOT_A,
            studentId: STUDENT_ID,
            status: "ACTIVE",
            endedAt: null,
          },
        ],
        students: [
          { id: STUDENT_ID, status: "ACTIVE", graduatedAt: null },
        ],
      })
    ),
    true
  );
});

test("12. Student former plot is denied", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "STUDENT_FARMER",
      STUDENT_ID,
      PLOT_A,
      createPlotLookup({
        plots: [{ id: PLOT_A, facultyId: FACULTY_ID }],
        assignments: [
          {
            plotId: PLOT_A,
            studentId: STUDENT_ID,
            status: "INACTIVE",
            endedAt: new Date(),
          },
        ],
        students: [
          { id: STUDENT_ID, status: "ACTIVE", graduatedAt: null },
        ],
      })
    ),
    false
  );
});

test("13. Inactive user is denied by the access flow", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "STUDENT_FARMER",
      STUDENT_ID,
      PLOT_A,
      createPlotLookup({
        plots: [{ id: PLOT_A, facultyId: FACULTY_ID }],
        assignments: [
          {
            plotId: PLOT_A,
            studentId: STUDENT_ID,
            status: "ACTIVE",
            endedAt: null,
          },
        ],
        students: [
          { id: STUDENT_ID, status: "INACTIVE", graduatedAt: null },
        ],
      })
    ),
    false
  );
});

test("14. Graduated student is denied", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "STUDENT_FARMER",
      STUDENT_ID,
      PLOT_A,
      createPlotLookup({
        plots: [{ id: PLOT_A, facultyId: FACULTY_ID }],
        assignments: [
          {
            plotId: PLOT_A,
            studentId: STUDENT_ID,
            status: "ACTIVE",
            endedAt: null,
          },
        ],
        students: [
          {
            id: STUDENT_ID,
            status: "ACTIVE",
            graduatedAt: new Date(),
          },
        ],
      })
    ),
    false
  );
});

test("15. Admin archived direct plot access remains allowed", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "ADMIN",
      ADMIN_ID,
      ARCHIVED_PLOT,
      createPlotLookup({
        plots: [
          { id: ARCHIVED_PLOT, facultyId: null, status: "ARCHIVED" },
        ],
      })
    ),
    true
  );
});

test("16. Mobile malformed plotId maps to 400", async () => {
  const result = await resolveMobilePlotSelection(
    ["not-a-cuid"],
    async () => []
  );
  assert.deepEqual(result, { kind: "error", status: 400 });
});

test("17. Mobile inaccessible plotId maps to 404", async () => {
  const result = await resolveMobilePlotSelection([PLOT_B], async (plotId) => {
    assert.equal(plotId, PLOT_B);
    return [];
  });
  assert.deepEqual(result, { kind: "error", status: 404 });
});

test("18. Mobile supplied invalid plotId never falls back to all plots", async () => {
  let calls = 0;
  const result = await resolveMobilePlotSelection(["bad"], async () => {
    calls += 1;
    return [{ id: PLOT_A }];
  });
  assert.deepEqual(result, { kind: "error", status: 400 });
  assert.equal(calls, 0);
});

test("19. Report all-plots student scope contains endedAt null", () => {
  const where = buildReportPlotWhere("STUDENT_FARMER", STUDENT_ID);
  const roleWhere = (where.AND as Prisma.PlotWhereInput[])[0];
  assert.equal(
    (
      roleWhere.assignments as {
        some: { endedAt: null };
      }
    ).some.endedAt,
    null
  );
});

test("20. Faculty student-activity queries stay limited to advised plot IDs", () => {
  const advisedPlotIds = [PLOT_A];
  assert.deepEqual(
    buildStudentActivityAssignmentWhere("FACULTY", advisedPlotIds),
    {
      status: "ACTIVE",
      endedAt: null,
      plotId: { in: advisedPlotIds },
    }
  );
  assert.deepEqual(
    buildStudentActivityGrowthLogWhere("FACULTY", advisedPlotIds, {
      userId: STUDENT_ID,
    }),
    {
      userId: STUDENT_ID,
      plotId: { in: advisedPlotIds },
    }
  );
});

test("21. Direct report authorization uses the canonical direct predicate", () => {
  assert.deepEqual(
    buildDirectPlotAccessWhere("FACULTY", FACULTY_ID, PLOT_A),
    buildAccessiblePlotWhere(
      { role: "FACULTY", userId: FACULTY_ID },
      { id: PLOT_A }
    )
  );
});

test("22. Web reading-history Faculty cross-plot access is denied", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "FACULTY",
      FACULTY_ID,
      PLOT_B,
      createPlotLookup({
        plots: [{ id: PLOT_B, facultyId: OTHER_FACULTY_ID }],
      })
    ),
    false
  );
});

test("23. Faculty student-activity excludes inactive or graduated students", () => {
  assert.deepEqual(buildStudentActivityStudentWhere("FACULTY", [PLOT_A]), {
    role: "STUDENT_FARMER",
    status: "ACTIVE",
    graduatedAt: null,
    studentAssignments: {
      some: {
        status: "ACTIVE",
        endedAt: null,
        plotId: { in: [PLOT_A] },
      },
    },
  });
});

test("24. Plot IDs use the project's CUID format", () => {
  assert.equal(isValidPlotId(PLOT_A), true);
  assert.equal(isValidPlotId("plot-1"), false);
});

test("25. Mobile valid supplied plot returns only the requested result", async () => {
  const result = await resolveMobilePlotSelection([PLOT_A], async (plotId) => {
    assert.equal(plotId, PLOT_A);
    return [{ id: PLOT_A }];
  });
  assert.deepEqual(result, { kind: "ok", plots: [{ id: PLOT_A }] });
});

test("26. Admin student-activity behavior remains unrestricted", () => {
  assert.deepEqual(buildStudentActivityStudentWhere("ADMIN", []), {
    role: "STUDENT_FARMER",
  });
  assert.deepEqual(buildStudentActivityGrowthLogWhere("ADMIN", [], {
    userId: STUDENT_ID,
  }), {
    userId: STUDENT_ID,
  });
});

test("27. Missing direct plot is denied for Admin so APIs can return 404", async () => {
  assert.equal(
    await assertCanAccessPlot(
      "ADMIN",
      ADMIN_ID,
      PLOT_A,
      createPlotLookup({ plots: [] })
    ),
    false
  );
});

test("28. Unknown role produces an impossible plot predicate", () => {
  const where = buildAccessiblePlotWhere({
    role: "UNSUPPORTED" as UserRole,
    userId: "unknown",
  });
  assert.deepEqual(where, {
    AND: [{ id: { in: [] } }, {}],
  });
});

test("29. Unknown role cannot authorize an existing direct plot", async () => {
  const allowed = await assertCanAccessPlot(
    "UNSUPPORTED" as UserRole,
    "unknown",
    PLOT_A,
    createPlotLookup({
      plots: [{ id: PLOT_A, facultyId: null }],
    })
  );
  assert.equal(allowed, false);
});

test("30. Absent optional plotId selects all accessible plots", async () => {
  const result = await resolveMobilePlotSelection([], async (plotId) => {
    assert.equal(plotId, undefined);
    return [{ id: PLOT_A }, { id: PLOT_B }];
  });
  assert.deepEqual(result, {
    kind: "ok",
    plots: [{ id: PLOT_A }, { id: PLOT_B }],
  });
});

test("31. Supplied empty plotId is rejected without a lookup", async () => {
  let calls = 0;
  const result = await resolveMobilePlotSelection([""], async () => {
    calls += 1;
    return [{ id: PLOT_A }];
  });
  assert.deepEqual(result, { kind: "error", status: 400 });
  assert.equal(calls, 0);
  assert.deepEqual(parseOptionalPlotIdValues([""]), {
    kind: "invalid",
    reason: "empty",
  });
});

test("32. Supplied whitespace plotId is rejected", () => {
  assert.deepEqual(parseOptionalPlotIdValues(["   "]), {
    kind: "invalid",
    reason: "whitespace",
  });
});

test("33. Duplicate route plotId values are rejected", () => {
  const params = new URLSearchParams([
    ["plotId", PLOT_A],
    ["plotId", PLOT_B],
  ]);
  assert.deepEqual(parseOptionalPlotIdSearchParams(params), {
    kind: "invalid",
    reason: "duplicate",
  });
});

test("34. Duplicate values with an empty first plotId are rejected", () => {
  const params = new URLSearchParams([
    ["plotId", ""],
    ["plotId", PLOT_A],
  ]);
  assert.deepEqual(parseOptionalPlotIdSearchParams(params), {
    kind: "invalid",
    reason: "duplicate",
  });
});

test("35. Duplicate Server Component plotId values are rejected", () => {
  assert.deepEqual(parseOptionalPlotIdPageValue([PLOT_A, PLOT_B]), {
    kind: "invalid",
    reason: "duplicate",
  });
});

test("36. Valid Server Component plotId remains selected", () => {
  assert.deepEqual(parseOptionalPlotIdPageValue(PLOT_A), {
    kind: "valid",
    plotId: PLOT_A,
  });
});

test("37. Direct Faculty report plot query contains ownership and ID", () => {
  assert.deepEqual(
    buildReportPlotWhere("FACULTY", FACULTY_ID, { id: PLOT_A }),
    {
      AND: [{ facultyId: FACULTY_ID }, { id: PLOT_A }],
    }
  );
});

test("38. Direct Student report plot query contains current assignment rules", () => {
  const where = buildReportPlotWhere("STUDENT_FARMER", STUDENT_ID, {
    id: PLOT_A,
  });
  const [roleWhere, idWhere] = (
    where as { AND: Prisma.PlotWhereInput[] }
  ).AND;
  const assignment = (
    roleWhere.assignments as {
      some: {
        studentId: string;
        status: string;
        endedAt: null;
      };
    }
  ).some;

  assert.deepEqual(idWhere, { id: PLOT_A });
  assert.equal(assignment.studentId, STUDENT_ID);
  assert.equal(assignment.status, "ACTIVE");
  assert.equal(assignment.endedAt, null);
});

test("39. Direct Admin report query allows an existing archived plot", async () => {
  const findPlot = createPlotLookup({
    plots: [
      { id: ARCHIVED_PLOT, facultyId: null, status: "ARCHIVED" },
    ],
  });
  const result = await findPlot(
    buildReportPlotWhere("ADMIN", ADMIN_ID, { id: ARCHIVED_PLOT })
  );
  assert.deepEqual(result, { id: ARCHIVED_PLOT });
});

test("40. Direct Admin report query rejects a nonexistent plot", async () => {
  const findPlot = createPlotLookup({ plots: [] });
  const result = await findPlot(
    buildReportPlotWhere("ADMIN", ADMIN_ID, { id: PLOT_A })
  );
  assert.equal(result, null);
});

test("41. Faculty student activity excludes the same student's other plot", () => {
  const activity = [
    { plotId: PLOT_A, note: "requesting Faculty" },
    { plotId: PLOT_B, note: "other Faculty" },
  ];
  const where = buildStudentActivityGrowthLogWhere(
    "FACULTY",
    [PLOT_A],
    { userId: STUDENT_ID }
  );
  const allowedPlotIds = (where.plotId as { in: string[] }).in;
  const visible = activity.filter((row) =>
    allowedPlotIds.includes(row.plotId)
  );

  assert.deepEqual(visible, [
    { plotId: PLOT_A, note: "requesting Faculty" },
  ]);
});

test("42. Web reading-history wiring denies another Faculty's plot", async () => {
  const plot = await findReadingHistoryPlot(
    "FACULTY",
    FACULTY_ID,
    PLOT_B,
    createPlotLookup({
      plots: [{ id: PLOT_B, facultyId: OTHER_FACULTY_ID }],
    })
  );
  assert.equal(plot, null);
});

test("43. Invalid observation drill-down plotId denies instead of aggregating", () => {
  const where = plotScopeFilter("ADMIN", ADMIN_ID, "");
  assert.deepEqual(where, {
    AND: [{}, { id: { in: [] } }],
  });
});
