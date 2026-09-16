import type { Prisma, UserRole, UserStatus } from "@prisma/client";

export type AssignmentActor = {
  role: UserRole;
  userId: string;
};

export type AssignmentListFilters = {
  plotId?: string;
  section?: string;
  search?: string;
};

const ASSIGNMENT_FILTER_PARAMS = ["search", "section", "plotId"] as const;

export function clearAssignmentFilterParams(queryString: string): string {
  const params = new URLSearchParams(queryString);
  for (const param of ASSIGNMENT_FILTER_PARAMS) {
    params.delete(param);
  }
  return params.toString();
}

export type AssignmentCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  email: string;
  course: string | null;
  yearLevel: string | null;
  section: string | null;
};

export function assignmentCandidateRequestKey(target: {
  plotId: string;
  course: string | null;
  section: string;
}): string {
  return JSON.stringify([target.plotId, target.course, target.section]);
}

type AssignmentStudent = {
  role: UserRole;
  status: UserStatus;
  graduatedAt: Date | null;
} | null;

export function assignmentSearchTokens(search?: string): string[] {
  return search?.trim().split(/\s+/).filter(Boolean) ?? [];
}

export function buildAssignmentListWhere(
  actor: AssignmentActor,
  filters: AssignmentListFilters = {}
): Prisma.PlotAssignmentWhereInput {
  const roleWhere: Prisma.PlotAssignmentWhereInput =
    actor.role === "STUDENT_FARMER"
      ? { studentId: actor.userId }
      : actor.role === "FACULTY"
        ? { plot: { is: { facultyId: actor.userId } } }
        : actor.role === "ADMIN" || actor.role === "SUPER_ADMIN"
          ? {}
          : { id: { in: [] } };

  const searchWhere = assignmentSearchTokens(filters.search).map(
    (token): Prisma.PlotAssignmentWhereInput => ({
      student: {
        is: {
          OR: [
            { firstName: { contains: token, mode: "insensitive" } },
            { lastName: { contains: token, mode: "insensitive" } },
            { email: { contains: token, mode: "insensitive" } },
            { idNumber: { contains: token, mode: "insensitive" } },
          ],
        },
      },
    })
  );

  return {
    AND: [
      roleWhere,
      { status: "ACTIVE" },
      ...(filters.plotId ? [{ plotId: filters.plotId }] : []),
      ...(filters.section
        ? [{ student: { is: { section: filters.section } } }]
        : []),
      ...searchWhere,
    ],
  };
}

export function candidateSections(
  candidates: Pick<AssignmentCandidate, "section">[]
): string[] {
  return [
    ...new Set(
      candidates
        .map((candidate) => candidate.section)
        .filter((section): section is string => Boolean(section))
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function defaultCandidateSection(
  role: UserRole,
  sections: string[]
): string | undefined {
  return role === "FACULTY" && sections.length === 1 ? sections[0] : undefined;
}

export function candidatesInSection(
  candidates: AssignmentCandidate[],
  section?: string
): AssignmentCandidate[] {
  return section
    ? candidates.filter((candidate) => candidate.section === section)
    : candidates;
}

export function shouldClearSelectedStudent(
  candidates: AssignmentCandidate[],
  selectedStudentId: string,
  section?: string
): boolean {
  if (!selectedStudentId) return false;
  return !candidatesInSection(candidates, section).some(
    (candidate) => candidate.id === selectedStudentId
  );
}

export function candidateSearchKeywords(
  candidate: AssignmentCandidate
): string[] {
  return [
    `${candidate.firstName} ${candidate.lastName}`,
    candidate.idNumber,
    candidate.email,
  ].filter((value): value is string => Boolean(value));
}

export function assignmentRequestError({
  student,
  sectionAuthorized,
  hasActiveAssignment,
}: {
  student: AssignmentStudent;
  sectionAuthorized: boolean;
  hasActiveAssignment: boolean;
}): string | null {
  if (!student || student.role !== "STUDENT_FARMER") {
    return "Selected user is not a student farmer";
  }
  if (student.status !== "ACTIVE") {
    return "Cannot assign an inactive student to a plot.";
  }
  if (student.graduatedAt) {
    return "Cannot assign a graduated student to a plot.";
  }
  if (!sectionAuthorized) {
    return "You are not authorized to assign a student from this section.";
  }
  if (hasActiveAssignment) {
    return "This student is already assigned to this plot";
  }
  return null;
}
