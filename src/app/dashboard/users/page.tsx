import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { UsersTable } from "@/components/users/users-table";
import { SearchBar } from "@/components/ui/search-bar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RoleFilter } from "@/components/users/role-filter";
import { StatusFilter } from "@/components/users/status-filter";

const PAGE_SIZE = 20;

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
    page?: string;
  }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const role = sp.role && VALID_ROLES.includes(sp.role as UserRole)
    ? (sp.role as UserRole)
    : undefined;
  const status = sp.status && VALID_STATUSES.includes(sp.status as UserStatus)
    ? (sp.status as UserStatus)
    : undefined;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

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

  // Count + fetch in parallel
  const [totalUsers, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        idNumber: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const hasFilters = Boolean(search || role || status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage faculty members, student farmers, and administrators.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/users/import">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/users/new">
              <Plus className="w-4 h-4 mr-2" />
              Add user
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar placeholder="Search name, email, or ID..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          <RoleFilter current={role} />
          <StatusFilter current={status} />
          {hasFilters && (
            <Link
              href="/dashboard/users"
              className="text-sm text-green-600 hover:underline self-center"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500">
        {totalUsers === 0
          ? "No users match your filters"
          : `${totalUsers} user${totalUsers === 1 ? "" : "s"}${hasFilters ? " (filtered)" : ""}`}
      </div>

      {/* Table */}
      <UsersTable users={users} />

      {/* Pagination */}
      {totalUsers > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalUsers}
          itemLabel="users"
        />
      )}
    </div>
  );
}