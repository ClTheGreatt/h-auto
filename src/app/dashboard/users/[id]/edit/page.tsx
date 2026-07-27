import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { UserForm } from "@/components/users/user-form";
import { BackButton } from "@/components/analytics/back-button";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <BackButton label="Back" />
        <h1 className="text-2xl font-semibold text-foreground">
          Edit {user.firstName} {user.lastName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
      </div>

      <UserForm
        mode="edit"
        userId={user.id}
        defaultValues={{
          firstName: user.firstName,
          middleName: user.middleName ?? "",
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber ?? "",
          role: user.role,
          idNumber: user.idNumber ?? "",
          department: user.department ?? "",
          course: user.course ?? "",
          yearLevel: user.yearLevel ?? "",
          section: user.section ?? "",
          academicYear: user.academicYear ?? "",
          position: user.position ?? "",
          status: user.status,
        }}
      />
    </div>
  );
}