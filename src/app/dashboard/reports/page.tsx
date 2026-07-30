import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ReportCard } from "@/components/reports/report-card";
import { buildAccessiblePlotWhere } from "@/lib/alerts/scope";

export default async function ReportsPage() {
  const session = await requireAuth();
  const role = session.user.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isFacultyOrAdmin = isAdmin || role === "FACULTY";

  // Archived plots are excluded from reports; historical data for a plot
  // remains in the DB but stops surfacing once it's archived.
  const plotFilter = buildAccessiblePlotWhere(
    { role, userId: session.user.id },
    { status: { not: "ARCHIVED" } }
  );

  const plots = await prisma.plot.findMany({
    where: plotFilter,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const reports = [
    {
      type: "sensor-readings",
      title: "Sensor Readings",
      description:
        "All sensor data (soil moisture, temperature, humidity, light, NPK) collected from IoT devices within the selected range.",
      icon: "activity",
      iconColor: "bg-blue-100 text-blue-700",
      hasPlotFilter: true,
    },
    {
      type: "plot-performance",
      title: "Plot Performance",
      description:
        "Summary per plot: crop, stage, planting dates, growth metrics, sensor reading counts, and alert statistics.",
      icon: "sprout",
      iconColor: "bg-green-100 text-green-700",
      hasPlotFilter: false,
    },
    {
      type: "growth-log",
      title: "Growth Logs",
      description:
        "Chronological log entries with observations, plant height, leaf count, and notes from student farmers.",
      icon: "camera",
      iconColor: "bg-purple-100 text-purple-700",
      hasPlotFilter: true,
    },
    {
      type: "alerts",
      title: "Alerts",
      description:
        "Environmental threshold violations, severity levels, resolution status, and SMS notification delivery records.",
      icon: "bellring",
      iconColor: "bg-amber-100 text-amber-700",
      hasPlotFilter: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate and export PDF or Excel reports for documentation and
          analysis.
        </p>
      </div>

      <div data-tour="reports.grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <ReportCard
            key={r.type}
            type={r.type}
            title={r.title}
            description={r.description}
            icon={r.icon}
            iconColor={r.iconColor}
            plots={r.hasPlotFilter ? plots : undefined}
          />
        ))}

        {isAdmin && (
          <div data-tour="reports.system-activity">
            <ReportCard
              type="activity"
              title="System Activity"
              description="Audit log of system events: user creations, imports, plot setup, device registrations, and assignments. Admin only."
              icon="filetext"
              iconColor="bg-gray-100 text-gray-700"
            />
          </div>
        )}

        {isFacultyOrAdmin && (
          <div data-tour="reports.student-activity">
            <ReportCard
              type="student-activity"
              title="Student Activity"
              description="Per-student summary of logging activity: observations recorded, plots assigned, photos submitted, and last activity date. For faculty monitoring of student farmers."
              icon="filetext"
              iconColor="bg-indigo-100 text-indigo-700"
            />
          </div>
        )}
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base text-blue-900">
            About these reports
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-2">
          <p>
            <strong>PDF reports</strong> are ideal for printing, archiving, and
            sharing with non-technical stakeholders. They include the school
            branding header and formatted tables.
          </p>
          <p>
            <strong>Excel reports</strong> are best for further data analysis,
            sorting, filtering, and creating custom charts in spreadsheet
            software.
          </p>
          <p>
            All reports respect role-based access. Students see only data for
            their assigned plots.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
