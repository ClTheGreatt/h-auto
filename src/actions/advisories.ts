"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  MISSING_FACULTY_DEPARTMENT_ERROR,
  advisorySavePlan,
  isCanonicalAcademicProgram,
  missingRequestedCohort,
  normalizeRequestedCohorts,
  requestedCohortError,
  reviewSectionConflictError,
  type AcademicCohort,
} from "@/lib/academics/cohort-integrity";
import { SECTION_REGEX } from "@/lib/constants/user-import";

type RequestedCohort = { course: string; section: string };

export async function setFacultyAdvisories(
  facultyId: string,
  cohorts: RequestedCohort[],
  removeReviewIds: string[] = []
) {
  await requireAdmin();

  if (
    !facultyId ||
    !Array.isArray(cohorts) ||
    cohorts.some(
      (cohort) =>
        !cohort ||
        typeof cohort.course !== "string" ||
        typeof cohort.section !== "string"
    ) ||
    !Array.isArray(removeReviewIds) ||
    removeReviewIds.some((id) => typeof id !== "string" || !id)
  ) {
    return { error: "Invalid advised cohort request." };
  }

  const requested = normalizeRequestedCohorts(cohorts);
  const reviewIds = [...new Set(removeReviewIds)];

  const result = await prisma.$transaction(async (tx) => {
    const faculty = await tx.user.findUnique({
      where: { id: facultyId },
      select: { role: true, department: true },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return { error: "Selected user is not a faculty member." } as const;
    }
    const existingAdvisories = await tx.facultySectionAdvisory.findMany({
      where: { facultyId },
      select: { id: true, course: true, section: true },
    });
    const plan = advisorySavePlan(
      existingAdvisories,
      faculty.department,
      reviewIds
    );
    if ("error" in plan) return { error: plan.error } as const;

    if (!isCanonicalAcademicProgram(faculty.department)) {
      if (requested.length > 0) {
        return { error: MISSING_FACULTY_DEPARTMENT_ERROR } as const;
      }
      if (plan.reviewIdsToRemove.length > 0) {
        await tx.facultySectionAdvisory.deleteMany({
          where: {
            facultyId,
            id: { in: plan.reviewIdsToRemove },
          },
        });
      }
      return { success: true } as const;
    }

    for (const cohort of requested) {
      const error = requestedCohortError(faculty.department, cohort);
      if (error) return { error } as const;
    }

    const phaseAConflict = reviewSectionConflictError(
      requested,
      plan.reviewRowsToKeep
    );
    if (phaseAConflict) return { error: phaseAConflict } as const;

    if (requested.length > 0) {
      const existingCohorts = await tx.user.findMany({
        where: {
          role: "STUDENT_FARMER",
          OR: requested.map((cohort) => ({
            course: cohort.course,
            section: cohort.section,
          })),
        },
        select: { course: true, section: true },
        distinct: ["course", "section"],
      });
      const availableCohorts = existingCohorts.flatMap((cohort) =>
        isCanonicalAcademicProgram(cohort.course) && cohort.section
          ? [{ course: cohort.course, section: cohort.section }]
          : []
      );
      const missing = missingRequestedCohort(requested, availableCohorts);
      if (missing) {
        return {
          error:
            "The selected Section does not exist for this Course / Program.",
        } as const;
      }
    }

    if (plan.resolvedIdsToReplace.length > 0) {
      await tx.facultySectionAdvisory.deleteMany({
        where: { facultyId, id: { in: plan.resolvedIdsToReplace } },
      });
    }
    if (plan.reviewIdsToRemove.length > 0) {
      await tx.facultySectionAdvisory.deleteMany({
        where: {
          facultyId,
          id: { in: plan.reviewIdsToRemove },
        },
      });
    }
    if (requested.length > 0) {
      await tx.facultySectionAdvisory.createMany({
        data: requested.map((cohort) => ({ facultyId, ...cohort })),
        skipDuplicates: true,
      });
    }

    return { success: true } as const;
  });

  if ("error" in result) return result;

  revalidatePath(`/dashboard/users/${facultyId}`);
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/assignments");
  return result;
}

export async function getFacultyAdvisoryOptions(facultyId: string): Promise<{
  department: string | null;
  cohorts: AcademicCohort[];
}> {
  await requireAdmin();

  const faculty = await prisma.user.findUnique({
    where: { id: facultyId },
    select: { role: true, department: true },
  });
  if (!faculty || faculty.role !== "FACULTY") {
    return { department: null, cohorts: [] };
  }
  if (!isCanonicalAcademicProgram(faculty.department)) {
    return { department: faculty.department, cohorts: [] };
  }
  const department = faculty.department;

  const rows = await prisma.user.findMany({
    where: {
      role: "STUDENT_FARMER",
      course: department,
      section: { not: null },
    },
    select: { section: true },
    distinct: ["section"],
    orderBy: { section: "asc" },
  });

  return {
    department,
    cohorts: rows.flatMap((row) =>
      row.section && SECTION_REGEX.test(row.section)
        ? [{ course: department, section: row.section }]
        : []
    ),
  };
}
