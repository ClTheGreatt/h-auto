import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export default async function AssignmentsPage() {
  const session = await requireAuth();
  const role = session.user.role;

  const where =
    role === "STUDENT_FARMER"
      ? { studentId: session.user.id, status: "ACTIVE" as const }
      : role === "FACULTY"
      ? { facultyId: session.user.id, status: "ACTIVE" as const }
      : { status: "ACTIVE" as const };

  const assignments = await prisma.plotAssignment.findMany({
    where,
    orderBy: { assignedAt: "desc" },
    include: {
      plot: {
        include: {
          crop: { select: { name: true } },
        },
      },
      student: {
        select: { firstName: true, lastName: true, email: true },
      },
      faculty: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Assignments</h1>
        <p className="text-sm text-gray-500 mt-1">
          {role === "STUDENT_FARMER"
            ? "Plots assigned to you for monitoring."
            : role === "FACULTY"
            ? "Plots you've assigned to your students."
            : "All active plot assignments in the system."}
        </p>
      </div>

      {assignments.length === 0 ? (
        <div
          data-tour="assignments.list"
          className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md"
        >
          <ClipboardList className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          No active assignments yet.
          {(role === "FACULTY" ||
            role === "ADMIN" ||
            role === "SUPER_ADMIN") && (
            <div className="mt-2">
              <Link
                href="/dashboard/plots"
                className="text-green-600 hover:underline"
              >
                Go to plots
              </Link>{" "}
              to assign students.
            </div>
          )}
        </div>
      ) : (
        <div data-tour="assignments.list" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assignments.map((a) => {
            const initials =
              `${a.student.firstName[0]}${a.student.lastName[0]}`.toUpperCase();
            return (
              <Link
                key={a.id}
                href={`/dashboard/plots/${a.plot.id}`}
                className="bg-white border rounded-md p-4 hover:shadow-sm hover:border-green-300 transition"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-sm">
                        {a.student.firstName} {a.student.lastName}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {a.plot.name}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {a.plot.crop?.name ?? "No crop"}
                      {a.plot.location && ` • ${a.plot.location}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Assigned by {a.faculty.firstName} {a.faculty.lastName} •{" "}
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}