"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Undo2, Users as UsersIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteUserDialog } from "./delete-user-dialog";
import { UngraduateStudentDialog } from "./ungraduate-student-dialog";
import { StudentFarmerSection } from "./student-farmer-section";
import { cn } from "@/lib/utils";
import type { UserRole, UserStatus } from "@prisma/client";
import type { CourseGroup } from "@/lib/users/group-students";

export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  idNumber: string | null;
  course: string | null;
  yearLevel: string | null;
  section: string | null;
  academicYear: string | null;
  graduatedAt: Date | null;
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

export const STUDENT_FARMER_META = ROLE_META.STUDENT_FARMER;

const statusVariant: Record<UserStatus, StatusVariant> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
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

export function UsersTable({
  users,
  showStudentSection,
  courseGroups,
  hasFilters,
  advisoriesByFacultyId,
}: {
  users: UserRow[];
  showStudentSection: boolean;
  courseGroups: CourseGroup[];
  hasFilters: boolean;
  // Faculty only — one section-list per facultyId, fetched in a single
  // query by the page. Absent entirely for every other role's table.
  advisoriesByFacultyId?: Record<string, string[]>;
}) {
  if (users.length === 0 && !showStudentSection) {
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
  const otherRoles = ROLE_ORDER.filter(
    (role) => role !== "STUDENT_FARMER" && grouped[role].length > 0
  );

  return (
    <div className="space-y-4">
      {otherRoles.map((role) => (
        <RoleSection
          key={role}
          role={role}
          users={grouped[role]}
          advisoriesByFacultyId={role === "FACULTY" ? advisoriesByFacultyId : undefined}
        />
      ))}
      {showStudentSection && (
        <StudentFarmerSection courseGroups={courseGroups} hasFilters={hasFilters} />
      )}
    </div>
  );
}

function RoleSection({
  role,
  users,
  advisoriesByFacultyId,
}: {
  role: UserRole;
  users: UserRow[];
  advisoriesByFacultyId?: Record<string, string[]>;
}) {
  const meta = ROLE_META[role];

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={cn("text-sm font-semibold", meta.badgeColor)}>
              {meta.label}
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {users.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      <UserRowsTable users={users} advisoriesByFacultyId={advisoriesByFacultyId} />
    </section>
  );
}

// Shared column widths, so any table built from these pieces (RoleSection's
// own table, or the Student Farmers single continuous table) lines up
// identically regardless of how many rows/labels are interleaved above it.
// `showAdvisories` is only ever passed for the Faculty section's own table.
export function UserTableColgroup({
  showAdvisories = false,
}: {
  showAdvisories?: boolean;
} = {}) {
  return (
    <colgroup>
      <col className="w-[26%]" />
      <col className="w-[28%]" />
      <col className="w-[12%]" />
      <col className="w-[12%]" />
      {showAdvisories && <col className="w-[16%]" />}
      <col className="w-12" />
    </colgroup>
  );
}

export function UserTableHeaderRow({
  showAdvisories = false,
}: {
  showAdvisories?: boolean;
} = {}) {
  return (
    <TableRow>
      <TableHead className="px-4 text-xs">Name</TableHead>
      <TableHead className="px-4 text-xs">Email</TableHead>
      <TableHead className="px-4 text-xs">Status</TableHead>
      <TableHead className="px-4 text-xs">ID number</TableHead>
      {showAdvisories && (
        <TableHead className="px-4 text-xs">Advised sections</TableHead>
      )}
      <TableHead className="px-3"></TableHead>
    </TableRow>
  );
}

export function UserTableRow({
  user,
  advisedSections,
}: {
  user: UserRow;
  // Only ever passed by the Faculty section's table. `undefined` (Admin,
  // Super Admin, Student Farmer rows) renders no extra cell at all.
  advisedSections?: string[];
}) {
  const router = useRouter();

  return (
    <TableRow
      onClick={() => router.push(`/dashboard/users/${user.id}`)}
      className="cursor-pointer hover:bg-muted/50"
    >
      <TableCell className="px-4 py-3 font-medium">
        {user.firstName} {user.lastName}
      </TableCell>
      <TableCell className="truncate px-4 py-3 text-muted-foreground">
        {user.email}
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusBadge variant={statusVariant[user.status]}>
            {user.status}
          </StatusBadge>
          {/* Graduation is orthogonal to UserStatus — a graduated student
              still shows ACTIVE. Without this, seeing "ACTIVE" on the
              Graduated tab would read as a bug. */}
          {user.role === "STUDENT_FARMER" && user.graduatedAt && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
              GRADUATED
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {user.idNumber ?? "—"}
        {/* Graduated rows show academicYear so a repeating student is
            visually distinguishable from the new batch in the same section. */}
        {user.role === "STUDENT_FARMER" && user.graduatedAt && user.academicYear && (
          <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {user.academicYear}
          </span>
        )}
      </TableCell>
      {advisedSections !== undefined && (
        <TableCell className="px-4 py-3">
          {advisedSections.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {advisedSections.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </TableCell>
      )}
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
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/users/${user.id}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            {user.role === "STUDENT_FARMER" && user.graduatedAt && (
              <UngraduateStudentDialog
                userId={user.id}
                userName={`${user.firstName} ${user.lastName}`}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Undo2 className="w-4 h-4 mr-2" />
                    Un-graduate
                  </DropdownMenuItem>
                }
              />
            )}
            <DeleteUserDialog
              userId={user.id}
              userName={`${user.firstName} ${user.lastName}`}
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Standalone table with its own header, used for role sections that have no
// sub-grouping (Super Admin, Admin, Faculty).
export function UserRowsTable({
  users,
  advisoriesByFacultyId,
}: {
  users: UserRow[];
  advisoriesByFacultyId?: Record<string, string[]>;
}) {
  const showAdvisories = advisoriesByFacultyId !== undefined;

  return (
    <div>
      <Table className="min-w-[760px] table-fixed">
        <UserTableColgroup showAdvisories={showAdvisories} />
        <TableHeader>
          <UserTableHeaderRow showAdvisories={showAdvisories} />
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <UserTableRow
              key={user.id}
              user={user}
              advisedSections={
                showAdvisories ? advisoriesByFacultyId[user.id] ?? [] : undefined
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
