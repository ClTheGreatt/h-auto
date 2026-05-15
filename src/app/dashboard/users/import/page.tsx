import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { ImportForm } from "@/components/imports/import-form";

export default async function ImportUsersPage() {
  await requireAdmin();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link
          href="/dashboard/users"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to users
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Import users</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bulk-create faculty members or student farmers from a CSV file.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}