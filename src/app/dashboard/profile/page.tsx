import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ProfileInfoForm } from "@/components/profile/profile-info-form";
import { PasswordChangeForm } from "@/components/profile/password-change-form";
import { AppearanceForm } from "@/components/profile/appearance-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AvatarUploadForm } from "@/components/profile/avatar-upload-form";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      profileImage: true,
      role: true,
      status: true,
      idNumber: true,
      department: true,
      course: true,
      yearLevel: true,
      section: true,
      position: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const initials = `${user.firstName[0] ?? ""}${
    user.lastName[0] ?? ""
  }`.toUpperCase();
  const roleLabel = user.role.toLowerCase().replace("_", " ");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Profile & Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account information and preferences.
        </p>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
         <Avatar className="w-16 h-16">
              {user.profileImage && (
                <AvatarImage src={user.profileImage} alt="Profile photo" />
              )}
              <AvatarFallback className="bg-green-100 text-green-700 text-xl font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700 capitalize"
                >
                  {roleLabel}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {user.status.toLowerCase()}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

{/* Profile photo upload */}
      <AvatarUploadForm
        currentImage={user.profileImage}
        initials={initials}
      />
      {/* Edit profile */}
      <ProfileInfoForm
        defaultValues={{
          firstName: user.firstName,
          middleName: user.middleName ?? "",
          lastName: user.lastName,
          phoneNumber: user.phoneNumber ?? "",
        }}
      />

  {/* Change password */}
      <PasswordChangeForm />

      {/* Appearance (light/dark/system) */}
      <AppearanceForm />

      {/* Read-only account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Email
              </dt>
              <dd className="mt-1 text-gray-900">{user.email}</dd>
            </div>
            {user.idNumber && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  ID Number
                </dt>
                <dd className="mt-1 text-gray-900">{user.idNumber}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Role
              </dt>
              <dd className="mt-1 text-gray-900 capitalize">{roleLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Member since
              </dt>
              <dd className="mt-1 text-gray-900">
                {user.createdAt.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
            {user.role === "FACULTY" && (
              <>
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
            {user.role === "STUDENT_FARMER" && (
              <>
                {user.course && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Course
                    </dt>
                    <dd className="mt-1 text-gray-900">{user.course}</dd>
                  </div>
                )}
                {user.yearLevel && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Year level
                    </dt>
                    <dd className="mt-1 text-gray-900">{user.yearLevel}</dd>
                  </div>
                )}
                {user.section && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Section
                    </dt>
                    <dd className="mt-1 text-gray-900">{user.section}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
          <p className="text-xs text-gray-500 mt-4">
            To update your role, department, or other administrative details,
            please contact an administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}