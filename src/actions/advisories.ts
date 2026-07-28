"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { SECTION_REGEX } from "@/lib/constants/user-import";

// Replace-all semantics, not a diff: every call clears the faculty's
// current advisories and recreates exactly the set passed in. Simpler to
// reason about than a diff, and the caller (a dialog with local chip
// state) always has the full intended set on submit anyway.
export async function setFacultyAdvisories(facultyId: string, sections: string[]) {
  await requireAdmin();

  const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
  if (!faculty || faculty.role !== "FACULTY") {
    return { error: "Selected user is not a faculty member" };
  }

  // Uppercase, not lowercase — SECTION_REGEX is uppercase-only, and
  // lowercasing here would repeat the mistake that previously broke email
  // lookups elsewhere in this codebase.
  const normalized = Array.from(
    new Set(
      sections
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0)
    )
  );

  const invalid = normalized.filter((s) => !SECTION_REGEX.test(s));
  if (invalid.length > 0) {
    return {
      error: `Invalid section${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`,
    };
  }

  await prisma.$transaction([
    prisma.facultySectionAdvisory.deleteMany({ where: { facultyId } }),
    ...(normalized.length > 0
      ? [
          prisma.facultySectionAdvisory.createMany({
            data: normalized.map((section) => ({ facultyId, section })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/dashboard/users/${facultyId}`);
  return { success: true };
}

// Autocomplete source only — a freshly wiped DB legitimately returns [].
export async function getDistinctStudentSections(): Promise<string[]> {
  await requireAdmin();

  const rows = await prisma.user.findMany({
    where: { role: "STUDENT_FARMER", section: { not: null } },
    select: { section: true },
    distinct: ["section"],
    orderBy: { section: "asc" },
  });

  return rows.map((r) => r.section).filter((s): s is string => s !== null);
}
