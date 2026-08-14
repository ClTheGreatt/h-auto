import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin, canManageUser } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { UserDetailActionsMenu } from "@/components/users/user-detail-actions-menu";
import { FacultyAdvisories } from "@/components/users/faculty-advisories";
import { getDistinctStudentSections } from "@/actions/advisories";
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
  const session = await requireAdmin();
  const viewerRole = session.user.role;
  const canManageAdvisories =
    viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN";
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

  // Whether the viewer is allowed to deactivate THIS user (only a Super
  // Admin may manage an Admin/Super Admin target) — resolved server-side
  // and passed down as a plain boolean, same idiom as canManageAdvisories
  // above.
  const canManageTarget = canManageUser(viewerRole, user.role);

  const fullName = [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  const [advisories, allStudentSections, advisedPlots] =
    user.role === "FACULTY"
      ? await Promise.all([
          prisma.facultySectionAdvisory.findMany({
            where: { facultyId: user.id },
            select: { section: true },
            orderBy: { section: "asc" },
          }),
          getDistinctStudentSections(),
          prisma.plot.findMany({
            where: { facultyId: user.id, status: { not: "ARCHIVED" } },
            orderBy: { name: "asc" },
            select: { id: true, name: true, crop: { select: { name: true } } },
          }),
        ])
      : [[], [], []];

  // Same query shape as /dashboard/assignments (studentId + ACTIVE status,
  // plot+crop included), trimmed to skip the student/faculty includes that
  // page needs but this one already has from `user` itself.
  const plotAssignments =
    user.role === "STUDENT_FARMER"
      ? await prisma.plotAssignment.findMany({
          where: { studentId: user.id, status: "ACTIVE" },
          orderBy: [{ plot: { name: "asc" } }, { assignedAt: "desc" }],
          include: {
            plot: { select: { id: true, name: true, crop: { select: { name: true } } } },
          },
        })
      : [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href="/dashboard/users"
          className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to users
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{fullName}</h1>
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
              {user.role === "STUDENT_FARMER" && user.graduatedAt && (
                <Badge variant="secondary" className="bg-muted text-gray-700">
                  GRADUATED {formatDateTime(user.graduatedAt)}
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
            <UserDetailActionsMenu
              userId={user.id}
              userName={fullName}
              userEmail={user.email}
              userStatus={user.status}
              canManage={canManageTarget}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profile overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-6">
              <Avatar className="size-24">
                {user.profileImage && (
                  <AvatarImage src={user.profileImage} alt={fullName} />
                )}
                <AvatarFallback className="bg-green-100 text-green-700 text-2xl font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <dl className="grid grid-cols-1 gap-4 text-sm flex-1">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email
                  </dt>
                  <dd className="mt-1 text-foreground">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Phone
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {user.phoneNumber ?? "—"}
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
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ID Number
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.idNumber ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Course
                    </dt>
                    <dd className="mt-1 text-foreground">{user.course ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Year Level
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.yearLevel ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Section
                    </dt>
                    <dd className="mt-1 text-foreground">{user.section ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Academic year
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.academicYear ?? "—"}
                    </dd>
                  </div>
                </>
              ) : user.role === "FACULTY" ? (
                <>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Employee ID
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.idNumber ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Department
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.department ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Position
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.position ?? "—"}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Employee ID
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {user.idNumber ?? "—"}
                    </dd>
                  </div>
                  {user.department && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Department
                      </dt>
                      <dd className="mt-1 text-foreground">{user.department}</dd>
                    </div>
                  )}
                  {user.position && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Position
                      </dt>
                      <dd className="mt-1 text-foreground">{user.position}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Plot assignments (student farmers only) */}
      {user.role === "STUDENT_FARMER" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plot Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {plotAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active plot assignments.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plotAssignments.map((a) => (
                  <Link
                    key={a.id}
                    href={`/dashboard/plots/${a.plot.id}`}
                    className="rounded-md border p-3 hover:shadow-sm hover:border-green-300 transition"
                  >
                    <div className="font-medium text-sm">{a.plot.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.plot.crop?.name ?? "No crop"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Assigned {formatDateTime(a.assignedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advised sections + advised plots (faculty only) */}
      {user.role === "FACULTY" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <FacultyAdvisories
                facultyId={user.id}
                initialSections={advisories.map((a) => a.section)}
                allSections={allStudentSections}
                canManageAdvisories={canManageAdvisories}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advised Plots</CardTitle>
            </CardHeader>
            <CardContent>
              {advisedPlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No plots assigned as adviser.
                </p>
              ) : (
                <div className="space-y-2">
                  {advisedPlots.map((plot) => (
                    <Link
                      key={plot.id}
                      href={`/dashboard/plots/${plot.id}`}
                      className="block rounded-md border p-3 hover:shadow-sm hover:border-green-300 transition"
                    >
                      <div className="font-medium text-sm">{plot.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {plot.crop?.name ?? "No crop"}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Account created
              </dt>
              <dd className="mt-1 text-foreground">
                {formatDateTime(user.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Last updated
              </dt>
              <dd className="mt-1 text-foreground">
                {formatDateTime(user.updatedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Last login
              </dt>
              <dd className="mt-1 text-foreground">
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
