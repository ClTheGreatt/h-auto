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

const VALID_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FACULTY",
  "STUDENT_FARMER",
];

const VALID_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    role?: string;
    status?: string;
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

  // Build Prisma filter
  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(status && { status }),
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
    },
  });

  const totalUsers = users.length;
  const hasFilters = Boolean(search || role || status);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Grouped by role for easier browsing.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none" asChild>
            <Link href="/dashboard/users/import">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Link>
          </Button>
          <Button className="flex-1 sm:flex-none" asChild>
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
      <UsersTable users={users} />
    </div>
  );
}
