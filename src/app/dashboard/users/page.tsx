import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { UsersTable } from "@/components/users/users-table";
import { SearchBar } from "@/components/ui/search-bar";
import { RoleFilter } from "@/components/users/role-filter";
import { StatusFilter } from "@/components/users/status-filter";
import { CourseFilter } from "@/components/users/course-filter";
import { YearFilter } from "@/components/users/year-filter";
import { SectionFilter } from "@/components/users/section-filter";
import { AcademicYearFilter } from "@/components/users/academic-year-filter";
import { GraduateStudentsDialog } from "@/components/users/graduate-students-dialog";
import {
  groupStudents,
  uniqueCourses,
  uniqueYearLevels,
  uniqueSections,
  uniqueAcademicYears,
} from "@/lib/users/group-students";

const VALID_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FACULTY",
  "STUDENT_FARMER",
];

const VALID_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE"];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    role?: string;
    status?: string;
    course?: string;
    year?: string;
    section?: string;
    academicYear?: string;
    view?: string;
  }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const role =
    sp.role && VALID_ROLES.includes(sp.role as UserRole)
      ? (sp.role as UserRole)
      : undefined;
  const status =
    sp.status && VALID_STATUSES.includes(sp.status as UserStatus)
      ? (sp.status as UserStatus)
      : undefined;
  // Active/Graduated tab. Applied as a plain graduatedAt where-clause across
  // the whole query (not just students) — harmless for Admin/Faculty/Super
  // Admin rows since graduatedAt is always null for them, so this behaves
  // identically to a student-only-scoped filter without the extra code.
  const view = sp.view === "graduated" ? "graduated" : "active";

  // Course/Year/Section/Academic year only mean anything for Student
  // Farmers, so they only take effect when the Role filter is "All roles"
  // or Student Farmer.
  const studentFiltersActive = !role || role === "STUDENT_FARMER";

  // Baseline (unfiltered) roster of every student's course/year/section/
  // academicYear, used both to populate the filter dropdown options and to
  // compute the "X of Y" totals shown on group headers while a filter
  // narrows the main query. Deliberately NOT scoped by `view` — the
  // baseline represents the full roster regardless of the current tab.
  const studentFieldRows = await prisma.user.findMany({
    where: { role: "STUDENT_FARMER" },
    select: { course: true, yearLevel: true, section: true, academicYear: true },
  });
  const courseOptions = uniqueCourses(studentFieldRows);
  const yearOptions = uniqueYearLevels(studentFieldRows);
  const sectionOptions = uniqueSections(studentFieldRows);
  const academicYearOptions = uniqueAcademicYears(studentFieldRows);

  const course =
    studentFiltersActive && sp.course && courseOptions.includes(sp.course)
      ? sp.course
      : undefined;
  const yearLevel =
    studentFiltersActive && sp.year && yearOptions.includes(sp.year)
      ? sp.year
      : undefined;
  const section =
    studentFiltersActive && sp.section && sectionOptions.includes(sp.section)
      ? sp.section
      : undefined;
  const academicYear =
    studentFiltersActive &&
    sp.academicYear &&
    academicYearOptions.includes(sp.academicYear)
      ? sp.academicYear
      : undefined;

  // Build Prisma filter
  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(status && { status }),
    ...(course && { course }),
    ...(yearLevel && { yearLevel }),
    ...(section && { section }),
    ...(academicYear && { academicYear }),
    graduatedAt: view === "graduated" ? { not: null } : null,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { idNumber: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  // Fetch all matching users (grouped by role in the component, no pagination needed)
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      idNumber: true,
      course: true,
      yearLevel: true,
      section: true,
      academicYear: true,
      graduatedAt: true,
    },
  });

  const totalUsers = users.length;
  const hasFilters = Boolean(
    search || role || status || course || yearLevel || section || academicYear
  );

  const studentRows = users.filter((u) => u.role === "STUDENT_FARMER");
  const courseGroups = groupStudents(studentRows, studentFieldRows);
  const showStudentSection = studentFiltersActive;

  // Faculty group's "Advised sections" column — one query for every faculty
  // row currently on the page, grouped by facultyId, never per-row.
  const facultyIds = users
    .filter((u) => u.role === "FACULTY")
    .map((u) => u.id);
  const advisoryRows =
    facultyIds.length > 0
      ? await prisma.facultySectionAdvisory.findMany({
          where: { facultyId: { in: facultyIds } },
          select: { facultyId: true, section: true },
          orderBy: { section: "asc" },
        })
      : [];
  const advisoriesByFacultyId: Record<string, string[]> = {};
  for (const row of advisoryRows) {
    (advisoriesByFacultyId[row.facultyId] ??= []).push(row.section);
  }

  // Build URL preserving filters when switching tabs (page resets implicitly
  // since this page has no pagination).
  function tabUrl(targetView: "active" | "graduated"): string {
    const p = new URLSearchParams();
    if (targetView === "graduated") p.set("view", "graduated");
    if (search) p.set("search", search);
    if (role) p.set("role", role);
    if (status) p.set("status", status);
    if (course) p.set("course", course);
    if (yearLevel) p.set("year", yearLevel);
    if (section) p.set("section", section);
    if (academicYear) p.set("academicYear", academicYear);
    const qs = p.toString();
    return `/dashboard/users${qs ? "?" + qs : ""}`;
  }

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage user accounts, roles, and permissions.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            data-tour="users.import-button"
            variant="outline"
            className="flex-1 sm:flex-none"
            asChild
          >
            <Link href="/dashboard/users/import">
              <Upload className="w-4 h-4 mr-2" />
              Import users
            </Link>
          </Button>
          <Button data-tour="users.add-button" className="flex-1 sm:flex-none" asChild>
            <Link href="/dashboard/users/new">
              <Plus className="w-4 h-4 mr-2" />
              Add user
            </Link>
          </Button>
        </div>
      </div>

      {/* Active/Graduated tabs */}
      <div className="flex items-center gap-2">
        <Link
          href={tabUrl("active")}
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (view === "active"
              ? "bg-green-100 text-green-700 font-medium"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          Active
        </Link>
        <Link
          href={tabUrl("graduated")}
          className={
            "px-3 py-1.5 rounded-md text-sm transition " +
            (view === "graduated"
              ? "bg-green-100 text-green-700 font-medium"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          Graduated
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-md border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-[380px] lg:w-[460px]">
              <SearchBar placeholder="Search name, email, or ID..." />
            </div>
            <div className="flex flex-wrap gap-2">
              <RoleFilter current={role} />
              <StatusFilter current={status} />
              <CourseFilter
                current={course}
                options={courseOptions}
                disabled={!studentFiltersActive}
              />
              <YearFilter
                current={yearLevel}
                options={yearOptions}
                disabled={!studentFiltersActive}
              />
              <SectionFilter
                current={section}
                options={sectionOptions}
                disabled={!studentFiltersActive}
              />
              <AcademicYearFilter
                current={academicYear}
                options={academicYearOptions}
                disabled={!studentFiltersActive}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground lg:justify-end">
            <span className="whitespace-nowrap">
              {totalUsers === 0
                ? "No users match your filters"
                : `${totalUsers} user${totalUsers === 1 ? "" : "s"}${
                    hasFilters ? " found" : ""
                  }`}
            </span>
            {hasFilters && (
              <Link
                href="/dashboard/users"
                className="shrink-0 text-sm font-medium text-green-700 hover:underline"
              >
                Clear filters
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mark as graduated — filter-then-confirm, only on the Active tab.
          A section isn't a cohort (some students repeat a year), so this
          always operates on the explicitly checked subset of the currently
          filtered students, never a blind bulk-by-section action. */}
      {view === "active" && showStudentSection && studentRows.length > 0 && (
        <div className="flex justify-end">
          <GraduateStudentsDialog
            students={studentRows.map((s) => ({
              id: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              idNumber: s.idNumber,
              course: s.course,
              yearLevel: s.yearLevel,
              section: s.section,
            }))}
          />
        </div>
      )}

      {/* Grouped table */}
      <div data-tour="users.list">
        <UsersTable
          users={users}
          showStudentSection={showStudentSection}
          courseGroups={courseGroups}
          hasFilters={hasFilters}
          advisoriesByFacultyId={advisoriesByFacultyId}
        />
      </div>
    </div>
  );
}
