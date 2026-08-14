import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAdmin, canManageUser } from "@/lib/auth-helpers";
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
    neverLogged?: string;
  }>;
}) {
  const session = await requireAdmin();

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
  const neverLogged = sp.neverLogged === "true";

  // Filters shared by every count/list query below except the one each is
  // deliberately excluding (status for inactiveCount, role/neverLogged for
  // neverLoggedCount — see each query's own comment).
  const commonWhere: Prisma.UserWhereInput = {
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
  // Split out the status-independent part so the inactive-count query below
  // can reuse it with status forced to INACTIVE, regardless of whatever the
  // status filter is currently set to — "how many inactive users match
  // everything else" shouldn't collapse to a redundant echo of the main
  // count when the admin has already narrowed to Inactive themselves.
  // neverLogged pins role to STUDENT_FARMER and requires zero growth logs,
  // overriding any explicit role filter — see the "N never logged" link.
  const baseWhere: Prisma.UserWhereInput = {
    ...commonWhere,
    ...(role && { role }),
    ...(neverLogged && { role: "STUDENT_FARMER", growthLogs: { none: {} } }),
  };
  const where: Prisma.UserWhereInput = {
    ...baseWhere,
    ...(status && { status }),
  };

  // The Role filter and neverLogged both pin `role`; if an explicit,
  // conflicting role filter is active (e.g. Faculty), no student can ever
  // match, so skip the query below and report 0 rather than silently
  // overriding the admin's own role filter.
  const studentFilterConflict = Boolean(role) && role !== "STUDENT_FARMER";

  // Fetch all matching users (grouped by role in the component, no
  // pagination needed), how many INACTIVE users match every filter except
  // status, and how many STUDENT_FARMER users with zero growth logs match
  // every filter except role/neverLogged themselves — each toolbar figure
  // surfaces a state the default view would otherwise hide.
  const [rawUsers, inactiveCount, neverLoggedCount] = await Promise.all([
    prisma.user.findMany({
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
    }),
    prisma.user.count({ where: { ...baseWhere, status: "INACTIVE" } }),
    studentFilterConflict
      ? Promise.resolve(0)
      : prisma.user.count({
          where: {
            ...commonWhere,
            role: "STUDENT_FARMER",
            ...(status && { status }),
            growthLogs: { none: {} },
          },
        }),
  ]);

  // Whether the viewer is allowed to deactivate this specific row's account
  // (Only a Super Admin may manage an Admin/Super Admin target — see
  // canManageUser). Resolved once here, server-side, and passed down as a
  // plain boolean so the client table never needs to import auth-helpers.ts
  // (which also pulls in server-only session code) just to hide a button —
  // same idiom as canManageAdvisories on the user detail page.
  const users = rawUsers.map((u) => ({
    ...u,
    canManage: canManageUser(session.user.role, u.role),
  }));

  const totalUsers = users.length;
  const hasFilters = Boolean(
    search ||
      role ||
      status ||
      course ||
      yearLevel ||
      section ||
      academicYear ||
      neverLogged
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

  // Student Farmers' PLOTS column and "never logged" marker — one pair of
  // queries for every student row currently on the page, grouped by
  // studentId, never per-row. Mirrors the advisoryRows pattern above.
  const studentIds = studentRows.map((u) => u.id);
  const [assignmentRows, loggedRows] =
    studentIds.length > 0
      ? await Promise.all([
          prisma.plotAssignment.findMany({
            where: { studentId: { in: studentIds }, status: "ACTIVE" },
            select: { studentId: true, plot: { select: { name: true } } },
            orderBy: { plot: { name: "asc" } },
          }),
          // Presence-only: which students have logged at least once. A full
          // count isn't needed since the row marker is a boolean.
          prisma.growthLog.findMany({
            where: { userId: { in: studentIds } },
            select: { userId: true },
            distinct: ["userId"],
          }),
        ])
      : [[], []];
  const plotNamesByStudentId: Record<string, string[]> = {};
  for (const row of assignmentRows) {
    (plotNamesByStudentId[row.studentId] ??= []).push(row.plot.name);
  }
  const loggedStudentIds = new Set(loggedRows.map((r) => r.userId));
  const neverLoggedByStudentId: Record<string, boolean> = {};
  for (const id of studentIds) {
    neverLoggedByStudentId[id] = !loggedStudentIds.has(id);
  }

  // Build URL preserving every current filter, with individual overrides
  // (page resets implicitly since this page has no pagination). Shared by
  // the Active/Graduated tab links and the toolbar's inactive/never-logged
  // count links so none of them build a query string by hand.
  function buildUsersUrl(
    overrides: {
      view?: "active" | "graduated";
      status?: UserStatus;
      neverLogged?: boolean;
    } = {}
  ): string {
    const targetView = overrides.view ?? view;
    const targetStatus = overrides.status ?? status;
    const targetNeverLogged = overrides.neverLogged ?? neverLogged;
    const p = new URLSearchParams();
    if (targetView === "graduated") p.set("view", "graduated");
    if (search) p.set("search", search);
    if (role) p.set("role", role);
    if (targetStatus) p.set("status", targetStatus);
    if (course) p.set("course", course);
    if (yearLevel) p.set("year", yearLevel);
    if (section) p.set("section", section);
    if (academicYear) p.set("academicYear", academicYear);
    if (targetNeverLogged) p.set("neverLogged", "true");
    const qs = p.toString();
    return `/dashboard/users${qs ? "?" + qs : ""}`;
  }

  function tabUrl(targetView: "active" | "graduated"): string {
    return buildUsersUrl({ view: targetView });
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
              {inactiveCount > 0 && (
                <>
                  {" · "}
                  <Link
                    href={buildUsersUrl({ status: "INACTIVE" })}
                    className="font-medium text-foreground hover:underline"
                  >
                    {inactiveCount} inactive
                  </Link>
                </>
              )}
              {neverLoggedCount > 0 && (
                <>
                  {" · "}
                  <Link
                    href={buildUsersUrl({ neverLogged: true })}
                    className="font-medium text-foreground hover:underline"
                  >
                    {neverLoggedCount} never logged
                  </Link>
                </>
              )}
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
          plotNamesByStudentId={plotNamesByStudentId}
          neverLoggedByStudentId={neverLoggedByStudentId}
        />
      </div>
    </div>
  );
}
