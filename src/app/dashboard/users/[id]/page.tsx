import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteUserDialog } from "@/components/users/delete-user-dialog";
import type { UserRole, UserStatus } from "@prisma/client";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  FACULTY: "Faculty",
  STUDENT_FARMER: "Student Farmer",
};

// Same color mapping as the role sections in users-table.tsx, applied here
// as a plain Badge since StatusBadge's 5 variants don't have a distinct
// color for each of the 4 roles.
const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  FACULTY: "bg-amber-100 text-amber-700",
  STUDENT_FARMER: "bg-green-100 text-green-700",
};

const statusVariant: Record<UserStatus, StatusVariant> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phoneNumber: true,
      role: true,
      idNumber: true,
      department: true,
      course: true,
      yearLevel: true,
      section: true,
      academicYear: true,
      graduatedAt: true,
      position: true,
      profileImage: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) notFound();

  const fullName = [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/users"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to users
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{fullName}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="secondary"
                className={ROLE_BADGE_CLASS[user.role]}
              >
                {ROLE_LABELS[user.role]}
              </Badge>
              <StatusBadge variant={statusVariant[user.status]}>
                {user.status}
              </StatusBadge>
              {user.graduatedAt && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                  Graduated {formatDateTime(user.graduatedAt)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/dashboard/users/${user.id}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DeleteUserDialog
                  userId={user.id}
                  userName={fullName}
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
          </div>
        </div>
      </div>

      {/* Profile overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="size-24">
              {user.profileImage && (
                <AvatarImage src={user.profileImage} alt={fullName} />
              )}
              <AvatarFallback className="bg-green-100 text-green-700 text-2xl font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm flex-1">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Email
                </dt>
                <dd className="mt-1 text-gray-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Phone
                </dt>
                <dd className="mt-1 text-gray-900">
                  {user.phoneNumber ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Middle name
                </dt>
                <dd className="mt-1 text-gray-900">
                  {user.middleName ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Role-specific details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {user.role === "STUDENT_FARMER"
              ? "Student Information"
              : user.role === "FACULTY"
              ? "Faculty Information"
              : "Administrative Information"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {user.role === "STUDENT_FARMER" ? (
              <>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    ID Number
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.idNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Course
                  </dt>
                  <dd className="mt-1 text-gray-900">{user.course ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Year Level
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.yearLevel ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Section
                  </dt>
                  <dd className="mt-1 text-gray-900">{user.section ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Academic year
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.academicYear ?? "—"}
                  </dd>
                </div>
              </>
            ) : user.role === "FACULTY" ? (
              <>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Employee ID
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.idNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Department
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.department ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Position
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.position ?? "—"}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Employee ID
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {user.idNumber ?? "—"}
                  </dd>
                </div>
                {user.department && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Department
                    </dt>
                    <dd className="mt-1 text-gray-900">{user.department}</dd>
                  </div>
                )}
                {user.position && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Position
                    </dt>
                    <dd className="mt-1 text-gray-900">{user.position}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Account activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Account created
              </dt>
              <dd className="mt-1 text-gray-900">
                {formatDateTime(user.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Last updated
              </dt>
              <dd className="mt-1 text-gray-900">
                {formatDateTime(user.updatedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Last login
              </dt>
              <dd className="mt-1 text-gray-900">
                {user.lastLoginAt
                  ? formatDateTime(user.lastLoginAt)
                  : "Never signed in"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
