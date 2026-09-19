import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assignableUserRoles, requireAdmin } from "@/lib/auth-helpers";
import { UserForm } from "@/components/users/user-form";

export default async function NewUserPage() {
  const session = await requireAdmin();
  const allowedRoles = assignableUserRoles(session.user.role);

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
        <h1 className="text-2xl font-semibold text-foreground">Add user</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {allowedRoles.includes("ADMIN")
            ? "Create a new account for a faculty member, student farmer, or admin."
            : "Create a new account for a faculty member or student farmer."}
        </p>
      </div>

      <UserForm mode="create" allowedRoles={allowedRoles} />
    </div>
  );
}
