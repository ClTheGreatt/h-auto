"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteUserDialog } from "./delete-user-dialog";
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

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  FACULTY: "Faculty",
  STUDENT_FARMER: "Student",
};

const roleColors: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  ADMIN: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  FACULTY: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  STUDENT_FARMER: "bg-green-100 text-green-700 hover:bg-green-100",
};

const statusColors: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700 hover:bg-green-100",
  INACTIVE: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  SUSPENDED: "bg-red-100 text-red-700 hover:bg-red-100",
};

export function UsersTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No users found"
        description="Try adjusting your search or filters, or add a new user to get started."
        action={{
          label: "Add user",
          href: "/dashboard/users/new",
        }}
      />
    );
  }

  return (
    <div className="border rounded-md bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>ID number</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {user.firstName} {user.lastName}
              </TableCell>
              <TableCell className="text-gray-600">{user.email}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={roleColors[user.role]}>
                  {roleLabels[user.role]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={statusColors[user.status]}>
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-600">
                {user.idNumber ?? "—"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
  );
}