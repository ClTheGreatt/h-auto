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
import {
  groupStudents,
  uniqueCourses,
  uniqueYearLevels,
  uniqueSections,
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

  // Course/Year/Section only mean anything for Student Farmers, so they only
  // take effect when the Role filter is "All roles" or Student Farmer.
  const studentFiltersActive = !role || role === "STUDENT_FARMER";

  // Baseline (unfiltered) roster of every student's course/year/section, used
  // both to populate the filter dropdown options and to compute the "X of Y"
  // totals shown on group headers while a filter narrows the main query.
  const studentFieldRows = await prisma.user.findMany({
    where: { role: "STUDENT_FARMER" },
    select: { course: true, yearLevel: true, section: true },
  });
  const courseOptions = uniqueCourses(studentFieldRows);
  const yearOptions = uniqueYearLevels(studentFieldRows);
  const sectionOptions = uniqueSections(studentFieldRows);

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

  // Build Prisma filter
  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(status && { status }),
    ...(course && { course }),
    ...(yearLevel && { yearLevel }),
    ...(section && { section }),
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
    },
  });

  const totalUsers = users.length;
  const hasFilters = Boolean(
    search || role || status || course || yearLevel || section
  );

  const studentRows = users.filter((u) => u.role === "STUDENT_FARMER");
  const courseGroups = groupStudents(studentRows, studentFieldRows);
  const showStudentSection = studentFiltersActive;

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
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
              Import CSV
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

      {/* Filters */}
      <div className="rounded-md border bg-white p-3 shadow-sm dark:bg-gray-900">
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
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-gray-500 lg:justify-end">
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

      {/* Grouped table */}
      <div data-tour="users.list">
        <UsersTable
          users={users}
          showStudentSection={showStudentSection}
          courseGroups={courseGroups}
          hasFilters={hasFilters}
        />
      </div>
    </div>
  );
}
