import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ACTIVITY_PLOT_STATUSES } from "@/lib/plots/lifecycle";
import { AssignmentPlotFilter } from "@/components/assignments/assignment-plot-filter";
import { AssignStudentDialog } from "@/components/assignments/assign-student-dialog";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string }>;
}) {
  const session = await requireAuth();
  const role = session.user.role;
  const sp = await searchParams;
  const plotId = sp.plotId;

  const where =
    role === "STUDENT_FARMER"
      ? { studentId: session.user.id, status: "ACTIVE" as const, ...(plotId && { plotId }) }
      : role === "FACULTY"
      ? { facultyId: session.user.id, status: "ACTIVE" as const, ...(plotId && { plotId }) }
      : { status: "ACTIVE" as const, ...(plotId && { plotId }) };

  // Plot list for filter dropdown, scoped the same way the page's own
  // role-aware where is (students/faculty only see their own plots).
  //
  // NOTE (investigated, not fixed in this batch): this STUDENT_FARMER branch
  // is missing the endedAt/student-active-and-not-graduated checks that
  // buildAccessiblePlotWhere's canonical STUDENT_FARMER branch has. Left
  // as-is per instruction — the new assignablePlotWhere below is a separate
  // query and does not inherit this gap.
  const plotWhere =
    role === "STUDENT_FARMER"
      ? {
          assignments: {
            some: { studentId: session.user.id, status: "ACTIVE" as const },
          },
        }
      : role === "FACULTY"
      ? { facultyId: session.user.id }
      : {};

  // "Plots this actor may assign a student to" — a stricter, separate scope
  // from plotWhere above (that one is a view filter for the existing
  // dropdown; this one gates the new assign flow). STUDENT_FARMER gets an
  // always-empty where — the button/dialog is also omitted from the JSX
  // entirely below, this is defense in depth, not the only guard.
  // Lifecycle: only SETUP + OPERATIONAL (ACTIVITY_PLOT_STATUSES) — a
  // HARVESTED/FALLOW/ARCHIVED plot takes no new monitors. Plots with no
  // adviser (facultyId null) are excluded too: assignStudent() rejects
  // those unconditionally with "Set a plot adviser before assigning
  // students," so showing them in the picker would only ever be a dead end
  // unrelated to which student was picked.
  const assignablePlotWhere: Prisma.PlotWhereInput =
    role === "SUPER_ADMIN" || role === "ADMIN"
      ? { facultyId: { not: null }, status: { in: ACTIVITY_PLOT_STATUSES } }
      : role === "FACULTY"
      ? {
          facultyId: session.user.id,
          status: { in: ACTIVITY_PLOT_STATUSES },
        }
      : { id: { in: [] } };

  const [assignments, plotsForFilter, assignablePlots] = await Promise.all([
    prisma.plotAssignment.findMany({
      where,
      orderBy: [{ plot: { name: "asc" } }, { assignedAt: "desc" }],
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
    }),
    prisma.plot.findMany({
      where: plotWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.plot.findMany({
      where: assignablePlotWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role === "STUDENT_FARMER"
            ? "Plots assigned to you for monitoring."
            : role === "FACULTY"
            ? "Plots you've assigned to your students."
            : "All active plot assignments in the system."}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center justify-between">
        <AssignmentPlotFilter plots={plotsForFilter} current={plotId} />
        {role !== "STUDENT_FARMER" && (
          <AssignStudentDialog plots={assignablePlots} />
        )}
      </div>

      {assignments.length === 0 ? (
        <div
          data-tour="assignments.list"
          className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-md"
        >
          <ClipboardList className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          No active assignments yet.
          {(role === "FACULTY" ||
            role === "ADMIN" ||
            role === "SUPER_ADMIN") && (
            <div className="mt-2">
              Use &ldquo;Assign student&rdquo; above to get started.
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
                className="bg-card border rounded-md p-4 hover:shadow-sm hover:border-green-300 transition"
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
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.plot.crop?.name ?? "No crop"}
                      {a.plot.location && ` • ${a.plot.location}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Adviser: {a.faculty.firstName} {a.faculty.lastName} •{" "}
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