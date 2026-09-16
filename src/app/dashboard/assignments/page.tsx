import Link from "next/link";
import { ClipboardList, X } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ACTIVITY_PLOT_STATUSES } from "@/lib/plots/lifecycle";
import { buildAssignableStudentsWhere } from "@/lib/students/assignable-students";
import { formatDate } from "@/lib/format-date";
import { AssignmentFiltersToolbar } from "@/components/assignments/assignment-filters-toolbar";
import { AssignStudentDialog } from "@/components/assignments/assign-student-dialog";
import { RemoveAssignmentDialog } from "@/components/plots/remove-assignment-dialog";
import {
  buildAssignmentListWhere,
  candidateSections,
} from "@/lib/assignments/assignment-filters";

type SearchParam = string | string[] | undefined;

function firstSearchParam(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: SearchParam;
    section?: SearchParam;
    plotId?: SearchParam;
  }>;
}) {
  const session = await requireAuth();
  const role = session.user.role;
  const sp = await searchParams;
  const canManageAssignments = role !== "STUDENT_FARMER";
  const search = firstSearchParam(sp.search)?.trim() || undefined;
  const section = firstSearchParam(sp.section)?.trim() || undefined;
  const plotId = firstSearchParam(sp.plotId)?.trim() || undefined;
  const actor = { role, userId: session.user.id };
  const filters = {
    plotId,
    ...(canManageAssignments ? { search, section } : {}),
  };
  const where = buildAssignmentListWhere(actor, filters);
  const unfilteredWhere = buildAssignmentListWhere(actor);
  const filtersActive = Boolean(
    plotId || (canManageAssignments && (search || section))
  );

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

  const sectionRowsPromise =
    role === "FACULTY"
      ? prisma.facultySectionAdvisory.findMany({
          where: { facultyId: session.user.id },
          orderBy: { section: "asc" },
          select: { section: true },
        })
      : canManageAssignments
        ? prisma.user.findMany({
            where: {
              role: "STUDENT_FARMER",
              section: { not: null },
              studentAssignments: { some: unfilteredWhere },
            },
            distinct: ["section"],
            orderBy: { section: "asc" },
            select: { section: true },
          })
        : Promise.resolve([] as { section: string | null }[]);

  const bulkCohortsPromise = canManageAssignments
    ? (async () => {
        const scope = await buildAssignableStudentsWhere(actor);
        const rows = await prisma.user.groupBy({
          where: { AND: [scope, { section: { not: null } }] },
          by: ["course", "section"],
        });
        return rows.filter(
          (row): row is { course: string | null; section: string } =>
            Boolean(row.section)
        );
      })()
    : Promise.resolve([] as { course: string | null; section: string }[]);

  const [
    assignments,
    plotsForFilter,
    assignablePlots,
    sectionRows,
    unfilteredAssignment,
    bulkCohorts,
  ] = await Promise.all([
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
        // Who actually made the assignment — may be an admin, a super
        // admin, or the adviser themselves. Distinct from `faculty` above
        // (always the plot's adviser, regardless of who clicked). Null on
        // rows created before this column existed — never fall back to
        // `faculty` in that case, that was the original mislabeling bug.
        assignedBy: {
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
    sectionRowsPromise,
    filtersActive
      ? prisma.plotAssignment.findFirst({
          where: unfilteredWhere,
          select: { id: true },
        })
      : Promise.resolve(null),
    bulkCohortsPromise,
  ]);
  const sectionOptions = candidateSections(sectionRows);
  const filtersHaveNoMatches =
    assignments.length === 0 && filtersActive && Boolean(unfilteredAssignment);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role === "STUDENT_FARMER"
            ? "Plots assigned to you for monitoring."
            : role === "FACULTY"
            ? "Active student assignments for plots you currently advise."
            : "All active plot assignments in the system."}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <AssignmentFiltersToolbar
          plots={plotsForFilter}
          currentPlotId={plotId}
          sections={sectionOptions}
          currentSection={section}
          canManageAssignments={canManageAssignments}
          showClearFilters={filtersHaveNoMatches}
        />
        {canManageAssignments && (
          <div className="sm:ml-auto">
            <AssignStudentDialog plots={assignablePlots} role={role} bulkCohorts={bulkCohorts} />
          </div>
        )}
      </div>

      {assignments.length === 0 ? (
        <div
          data-tour="assignments.list"
          className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-md"
        >
          <ClipboardList className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          {filtersHaveNoMatches
            ? "No assignments match these filters."
            : "No active assignments yet."}
          {!filtersHaveNoMatches && canManageAssignments ? (
            <div className="mt-2">
              Use &ldquo;Assign student&rdquo; above to get started.
            </div>
          ) : null}
        </div>
      ) : (
        <div data-tour="assignments.list" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assignments.map((a) => {
            const initials =
              `${a.student.firstName[0]}${a.student.lastName[0]}`.toUpperCase();
            return (
              <div
                key={a.id}
                className="bg-card border rounded-md p-4"
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
                      <Link
                        href={`/dashboard/plots/${a.plot.id}`}
                        className="hover:underline"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {a.plot.name}
                        </Badge>
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.plot.crop?.name ?? "No crop"}
                      {a.plot.location && ` • ${a.plot.location}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {a.assignedBy
                        ? `Assigned by ${a.assignedBy.firstName} ${a.assignedBy.lastName} · ${formatDate(a.assignedAt)}`
                        : `Assigned ${formatDate(a.assignedAt)}`}
                    </div>
                  </div>
                  {role !== "STUDENT_FARMER" && (
                    // The card is a plain <div>, not a <Link> — only the plot
                    // badge above navigates. Do not re-wrap the card in a
                    // Link: that would nest this <button> inside an <a>,
                    // which is invalid HTML and navigates on click no matter
                    // what the dialog's stopPropagation does (an anchor's
                    // navigation is a default action, not a listener).
                    <RemoveAssignmentDialog
                      assignmentId={a.id}
                      studentName={`${a.student.firstName} ${a.student.lastName}`}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger-text hover:text-danger-text shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
