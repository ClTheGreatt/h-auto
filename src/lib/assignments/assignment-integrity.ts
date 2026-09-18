import { Prisma, type PlotStatus, type UserRole, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertFacultyCanAssignStudent,
  canFacultyAdviseCohort,
} from "@/lib/auth/section-access";
import { isActivityPlotStatus } from "@/lib/plots/lifecycle";

export const TARGET_ADVISER_COHORT_ERROR =
  "The plot adviser is not currently eligible for the selected course and section.";

export type AssignmentIntegrityClient = Pick<
  Prisma.TransactionClient,
  "plot" | "user" | "plotAssignment"
>;

export type AssignmentIntegrityErrorCode =
  | "ACTOR_FORBIDDEN"
  | "ACTOR_NOT_PLOT_ADVISER"
  | "ACTOR_COHORT_FORBIDDEN"
  | "PLOT_NOT_FOUND"
  | "PLOT_INELIGIBLE"
  | "PLOT_ADVISER_REQUIRED"
  | "STUDENT_NOT_FOUND"
  | "STUDENT_ROLE_INVALID"
  | "STUDENT_INACTIVE"
  | "STUDENT_GRADUATED"
  | "TARGET_ADVISER_COHORT_INVALID"
  | "DUPLICATE_ACTIVE_ASSIGNMENT";

export type AssignmentIntegrityFailure = {
  ok: false;
  code: AssignmentIntegrityErrorCode;
  error: string;
};

type AssignmentStudent = {
  id: string;
  role: UserRole;
  status: UserStatus;
  graduatedAt: Date | null;
  course: string | null;
  section: string | null;
};

type AssignmentPlot = {
  facultyId: string;
  status: PlotStatus;
};

function failure(
  code: AssignmentIntegrityErrorCode,
  error: string
): AssignmentIntegrityFailure {
  return { ok: false, code, error };
}

export async function validateAssignmentCohortAuthorities(
  input: {
    actor: { role: UserRole; id: string };
    plotFacultyId: string;
    course: string | null;
    section: string | null;
  },
  client: Pick<AssignmentIntegrityClient, "user"> = prisma
): Promise<{ actorAuthorized: boolean; targetAdviserAuthorized: boolean }> {
  const actorAuthorized = await assertFacultyCanAssignStudent(
    input.actor.role,
    input.actor.id,
    input.course,
    input.section,
    client
  );

  // A Faculty caller on their own plot is also the target adviser. Reuse the
  // same canonical result instead of issuing a second, potentially divergent
  // cohort check. Admin actors still require an independent target check.
  const targetAdviserAuthorized =
    input.actor.role === "FACULTY" && input.actor.id === input.plotFacultyId
      ? actorAuthorized
      : await canFacultyAdviseCohort(
          input.plotFacultyId,
          input.course,
          input.section,
          client
        );

  return { actorAuthorized, targetAdviserAuthorized };
}

export async function validateFinalAssignment(
  input: {
    actor: { role: UserRole; id: string };
    plotId: string;
    studentId: string;
  },
  client: AssignmentIntegrityClient = prisma
): Promise<
  | AssignmentIntegrityFailure
  | { ok: true; plot: AssignmentPlot; student: AssignmentStudent }
> {
  if (
    input.actor.role !== "FACULTY" &&
    input.actor.role !== "ADMIN" &&
    input.actor.role !== "SUPER_ADMIN"
  ) {
    return failure("ACTOR_FORBIDDEN", "You are not authorized to assign students.");
  }

  const [plot, student] = await Promise.all([
    client.plot.findUnique({
      where: { id: input.plotId },
      select: { facultyId: true, status: true },
    }),
    client.user.findUnique({
      where: { id: input.studentId },
      select: {
        id: true,
        role: true,
        status: true,
        graduatedAt: true,
        course: true,
        section: true,
      },
    }),
  ]);

  if (!plot) return failure("PLOT_NOT_FOUND", "Plot not found");
  if (!isActivityPlotStatus(plot.status)) {
    return failure(
      "PLOT_INELIGIBLE",
      "Students can only be assigned while a plot is preparing or operational."
    );
  }
  if (!plot.facultyId) {
    return failure(
      "PLOT_ADVISER_REQUIRED",
      "Set a plot adviser before assigning students."
    );
  }
  if (input.actor.role === "FACULTY" && plot.facultyId !== input.actor.id) {
    return failure(
      "ACTOR_NOT_PLOT_ADVISER",
      "You are not the adviser of this plot."
    );
  }

  if (!student) return failure("STUDENT_NOT_FOUND", "Student not found");
  if (student.role !== "STUDENT_FARMER") {
    return failure(
      "STUDENT_ROLE_INVALID",
      "Only student farmers can be assigned to plots."
    );
  }
  if (student.status !== "ACTIVE") {
    return failure(
      "STUDENT_INACTIVE",
      "This student is inactive and cannot be assigned."
    );
  }
  if (student.graduatedAt) {
    return failure(
      "STUDENT_GRADUATED",
      "This student has already graduated and cannot be assigned."
    );
  }

  const [cohortAuthority, existing] = await Promise.all([
    validateAssignmentCohortAuthorities(
      {
        actor: input.actor,
        plotFacultyId: plot.facultyId,
        course: student.course,
        section: student.section,
      },
      client
    ),
    client.plotAssignment.findFirst({
      where: {
        plotId: input.plotId,
        studentId: input.studentId,
        status: "ACTIVE",
      },
      select: { id: true },
    }),
  ]);

  if (!cohortAuthority.actorAuthorized) {
    return failure(
      "ACTOR_COHORT_FORBIDDEN",
      "You are not authorized to assign a student from this course and section."
    );
  }
  if (!cohortAuthority.targetAdviserAuthorized) {
    return failure("TARGET_ADVISER_COHORT_INVALID", TARGET_ADVISER_COHORT_ERROR);
  }
  if (existing) {
    return failure(
      "DUPLICATE_ACTIVE_ASSIGNMENT",
      "This student is already assigned to this plot."
    );
  }

  return {
    ok: true,
    plot: { facultyId: plot.facultyId, status: plot.status },
    student,
  };
}

export async function runAssignmentTransaction<T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }
  throw new Error("Assignment transaction retry limit reached.");
}
