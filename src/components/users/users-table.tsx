"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteUserDialog } from "./delete-user-dialog";
import { cn } from "@/lib/utils";
import type { UserRole, UserStatus } from "@prisma/client";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  idNumber: string | null;
};

const ROLE_ORDER: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FACULTY",
  "STUDENT_FARMER",
];

const ROLE_META: Record<
  UserRole,
  {
    label: string;
    description: string;
    badgeColor: string;
  }
> = {
  SUPER_ADMIN: {
    label: "Super Admins",
    description: "Full system access",
    badgeColor: "text-purple-700 dark:text-purple-400",
  },
  ADMIN: {
    label: "Admins",
    description: "Manage users and devices",
    badgeColor: "text-blue-700 dark:text-blue-400",
  },
  FACULTY: {
    label: "Faculty",
    description: "Instructors and advisers",
    badgeColor: "text-amber-700 dark:text-amber-400",
  },
  STUDENT_FARMER: {
    label: "Student Farmers",
    description: "Field operators",
    badgeColor: "text-green-700 dark:text-green-400",
  },
};

const statusVariant: Record<UserStatus, StatusVariant> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
};

function groupByRole(users: UserRow[]): Record<UserRole, UserRow[]> {
  const grouped: Record<UserRole, UserRow[]> = {
    SUPER_ADMIN: [],
    ADMIN: [],
    FACULTY: [],
    STUDENT_FARMER: [],
  };
  for (const user of users) {
    grouped[user.role].push(user);
  }
  return grouped;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No users found"
       description="Try adjusting your search or filters, or add a new user."
        action={{
          label: "Add user",
          href: "/dashboard/users/new",
        }}
      />
    );
  }

  const grouped = groupByRole(users);
  const visibleRoles = ROLE_ORDER.filter((role) => grouped[role].length > 0);

  return (
    <div className="space-y-4">
      {visibleRoles.map((role) => (
        <RoleSection key={role} role={role} users={grouped[role]} />
      ))}
    </div>
  );
}

function RoleSection({ role, users }: { role: UserRole; users: UserRow[] }) {
  const router = useRouter();
  const meta = ROLE_META[role];

  return (
    <section className="overflow-hidden rounded-md border bg-white shadow-sm dark:bg-gray-900">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={cn("text-sm font-semibold", meta.badgeColor)}>
              {meta.label}
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {users.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
        </div>
      </div>

      {/* Mini-table for this role */}
      <div>
        <Table className="min-w-[760px] table-fixed">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[36%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-12" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 text-xs">Name</TableHead>
              <TableHead className="px-4 text-xs">Email</TableHead>
              <TableHead className="px-4 text-xs">Status</TableHead>
              <TableHead className="px-4 text-xs">ID number</TableHead>
              <TableHead className="px-3"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                onClick={() => router.push(`/dashboard/users/${user.id}`)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="px-4 py-3 font-medium">
                  {user.firstName} {user.lastName}
                </TableCell>
                <TableCell className="truncate px-4 py-3 text-gray-600">
                  {user.email}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <StatusBadge variant={statusVariant[user.status]}>
                    {user.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-600">
                  {user.idNumber ?? "—"}
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/users/${user.id}/edit`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DeleteUserDialog
                        userId={user.id}
                        userName={`${user.firstName} ${user.lastName}`}
                        trigger={
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        }
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
