import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { BRANDING } from "./branding";
import { formatDate, formatDateTime } from "@/lib/format-date";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  // Header
  header: {
    borderBottomWidth: 2,
    borderBottomColor: BRANDING.primaryColor,
    paddingBottom: 12,
    marginBottom: 16,
  },
  schoolName: { fontSize: 11, fontWeight: "bold", color: "#374151" },
  campus: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  systemName: {
    fontSize: 14,
    fontWeight: "bold",
    color: BRANDING.primaryColor,
    marginTop: 6,
  },
  tagline: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  // Title
  reportTitle: { fontSize: 16, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
    fontSize: 9,
    color: "#6b7280",
  },
  // Table
  table: { width: "100%", marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRANDING.primaryColor,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { color: "white", fontSize: 9, fontWeight: "bold" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  tableCell: { fontSize: 8 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9ca3af",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  // Misc
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 6,
    color: "#374151",
  },
  emptyState: {
    textAlign: "center",
    padding: 40,
    color: "#9ca3af",
    fontSize: 10,
  },
  // Growth log entry
  logEntry: {
    borderWidth: 0.5,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 9,
  },
  logMeta: { fontSize: 8, color: "#6b7280", marginBottom: 4 },
  logBody: { fontSize: 8 },
  // Severity colors
  badgeCritical: { backgroundColor: "#fee2e2", color: "#991b1b" },
  badgeWarning: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeInfo: { backgroundColor: "#dbeafe", color: "#1e40af" },
  badgeResolved: { backgroundColor: "#d1fae5", color: "#065f46" },
  badgeOpen: { backgroundColor: "#fee2e2", color: "#991b1b" },
});

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function ReportHeader({ title, meta }: { title: string; meta: string[] }) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.schoolName}>{BRANDING.schoolName}</Text>
      <Text style={styles.campus}>
        {BRANDING.campus} | {BRANDING.department}
      </Text>
      <Text style={styles.systemName}>{BRANDING.systemName}</Text>
      <Text style={styles.tagline}>{BRANDING.tagline}</Text>
      <Text style={styles.reportTitle}>{title}</Text>
      <View style={styles.metaRow}>
        {meta.map((m, i) => (
          <Text key={i}>{m}</Text>
        ))}
      </View>
    </View>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>{BRANDING.systemName} | Confidential Report</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function fmt(v: number | null, digits = 1): string {
  if (v == null) return "-";
  return v.toFixed(digits);
}

// ============================================================================
// REPORT 1: SENSOR READINGS
// ============================================================================

export function SensorReadingsPDF({
  data,
  rangeLabel,
  plotName,
}: {
  data: Array<{
    recordedAt: Date;
    plotName: string;
    deviceCode: string;
    soilMoisture: number | null;
    temperature: number | null;
    humidity: number | null;
    lightIntensity: number | null;
    nitrogen: number | null;
    phosphorus: number | null;
    potassium: number | null;
  }>;
  rangeLabel: string;
  plotName?: string;
}) {
  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total readings: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  // Header widths
  const cols = [
    { label: "Date / Time", width: "16%" },
    { label: "Plot", width: "10%" },
    { label: "Soil %", width: "8%" },
    { label: "Temp °C", width: "9%" },
    { label: "Hum %", width: "8%" },
    { label: "Light lux", width: "10%" },
    { label: "N", width: "8%" },
    { label: "P", width: "8%" },
    { label: "K", width: "8%" },
    { label: "Device", width: "15%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportHeader title="Sensor Readings Report" meta={meta} />

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No sensor readings found for the selected filters.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {cols.map((c, i) => (
                <Text
                  key={i}
                  style={[styles.tableHeaderCell, { width: c.width }]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {data.map((row, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "16%" }]}>
                  {formatDateTime(row.recordedAt)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.plotName}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {fmt(row.soilMoisture)}
                </Text>
                <Text style={[styles.tableCell, { width: "9%" }]}>
                  {fmt(row.temperature)}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {fmt(row.humidity)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {fmt(row.lightIntensity, 0)}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {fmt(row.nitrogen, 0)}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {fmt(row.phosphorus, 0)}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {fmt(row.potassium, 0)}
                </Text>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  {row.deviceCode}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

// ============================================================================
// REPORT 2: PLOT PERFORMANCE
// ============================================================================

export function PlotPerformancePDF({
  data,
  rangeLabel,
}: {
  data: Array<{
    plotName: string;
    location: string;
    crop: string;
    variety: string;
    stage: string;
    status: string;
    plantingDate: Date | null;
    expectedHarvest: Date | null;
    readingCount: number;
    logCount: number;
    alertCount: number;
    openAlertCount: number;
    activeAssignments: number;
    latestHeight: number | null;
    latestLeafCount: number | null;
  }>;
  rangeLabel: string;
}) {
  const meta = [
    `Time range: ${rangeLabel}`,
    `Total plots: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const cols = [
    { label: "Plot", width: "10%" },
    { label: "Crop / Variety", width: "16%" },
    { label: "Stage", width: "10%" },
    { label: "Status", width: "10%" },
    { label: "Planted", width: "10%" },
    { label: "Harvest", width: "10%" },
    { label: "Readings", width: "8%" },
    { label: "Logs", width: "6%" },
    { label: "Alerts", width: "8%" },
    { label: "Latest H/L", width: "12%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportHeader title="Plot Performance Report" meta={meta} />

        {data.length === 0 ? (
          <Text style={styles.emptyState}>No plot data available.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {cols.map((c, i) => (
                <Text
                  key={i}
                  style={[styles.tableHeaderCell, { width: c.width }]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {data.map((row, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.plotName}
                </Text>
                <Text style={[styles.tableCell, { width: "16%" }]}>
                  {row.crop} / {row.variety}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.stage}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.status}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatDate(row.plantingDate)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatDate(row.expectedHarvest)}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.readingCount}
                </Text>
                <Text style={[styles.tableCell, { width: "6%" }]}>
                  {row.logCount}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.openAlertCount} / {row.alertCount}
                </Text>
                <Text style={[styles.tableCell, { width: "12%" }]}>
                  {row.latestHeight != null ? `${row.latestHeight}cm` : "-"}
                  {row.latestLeafCount != null
                    ? ` / ${row.latestLeafCount} leaves`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

// ============================================================================
// REPORT 3: GROWTH LOG
// ============================================================================

export function GrowthLogPDF({
  data,
  rangeLabel,
  plotName,
}: {
  data: Array<{
    createdAt: Date;
    plotName: string;
    stageName: string;
    authorName: string;
    plantHeightCm: number | null;
    leafCount: number | null;
    observations: string;
    notes: string;
    imageCount: number;
  }>;
  rangeLabel: string;
  plotName?: string;
}) {
  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total entries: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Growth Log Report" meta={meta} />

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No growth log entries found for the selected filters.
          </Text>
        ) : (
          data.map((log, i) => (
            <View key={i} style={styles.logEntry} wrap={false}>
              <View style={styles.logHeader}>
                <Text style={{ fontWeight: "bold" }}>
                  {log.plotName} | {log.stageName}
                </Text>
                <Text>{formatDateTime(log.createdAt)}</Text>
              </View>
              <Text style={styles.logMeta}>
                By {log.authorName}
                {log.plantHeightCm != null && ` | Height: ${log.plantHeightCm} cm`}
                {log.leafCount != null && ` | Leaves: ${log.leafCount}`}
                {log.imageCount > 0 && ` | Photos: ${log.imageCount}`}
              </Text>
              {log.observations && (
                <Text style={styles.logBody}>
                  <Text style={{ fontWeight: "bold" }}>Observations: </Text>
                  {log.observations}
                </Text>
              )}
              {log.notes && (
                <Text style={[styles.logBody, { marginTop: 4 }]}>
                  <Text style={{ fontWeight: "bold" }}>Notes: </Text>
                  {log.notes}
                </Text>
              )}
            </View>
          ))
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

// ============================================================================
// REPORT 4: ALERTS
// ============================================================================

export function AlertsPDF({
  data,
  rangeLabel,
  plotName,
}: {
  data: Array<{
    createdAt: Date;
    plotName: string;
    type: string;
    severity: string;
    message: string;
    resolved: boolean;
    resolvedAt: Date | null;
    notificationsSent: number;
    notificationsFailed: number;
    recipients: string;
  }>;
  rangeLabel: string;
  plotName?: string;
}) {
  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total alerts: ${data.length}`,
    `Open: ${data.filter((a) => !a.resolved).length}`,
    `Resolved: ${data.filter((a) => a.resolved).length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const cols = [
    { label: "Date", width: "14%" },
    { label: "Plot", width: "10%" },
    { label: "Severity", width: "10%" },
    { label: "Message", width: "32%" },
    { label: "Status", width: "10%" },
    { label: "SMS Sent", width: "10%" },
    { label: "Recipients", width: "14%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportHeader title="Alerts Report" meta={meta} />

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No alerts found for the selected filters.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {cols.map((c, i) => (
                <Text
                  key={i}
                  style={[styles.tableHeaderCell, { width: c.width }]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {data.map((row, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "14%" }]}>
                  {formatDateTime(row.createdAt)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.plotName}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.severity}
                </Text>
                <Text style={[styles.tableCell, { width: "32%" }]}>
                  {row.message}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.resolved ? "Resolved" : "Open"}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.notificationsSent}
                  {row.notificationsFailed > 0 &&
                    ` (${row.notificationsFailed} failed)`}
                </Text>
                <Text style={[styles.tableCell, { width: "14%" }]}>
                  {row.recipients || "-"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

// ============================================================================
// REPORT 5: SYSTEM ACTIVITY
// ============================================================================

export function ActivityPDF({
  data,
  rangeLabel,
}: {
  data: Array<{
    timestamp: Date;
    eventType: string;
    description: string;
    actor: string;
  }>;
  rangeLabel: string;
}) {
  const meta = [
    `Time range: ${rangeLabel}`,
    `Total events: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const cols = [
    { label: "Timestamp", width: "18%" },
    { label: "Event Type", width: "16%" },
    { label: "Description", width: "50%" },
    { label: "Actor", width: "16%" },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="System Activity Report" meta={meta} />

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No system activity found for the selected time range.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {cols.map((c, i) => (
                <Text
                  key={i}
                  style={[styles.tableHeaderCell, { width: c.width }]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {data.map((row, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "18%" }]}>
                  {formatDateTime(row.timestamp)}
                </Text>
                <Text style={[styles.tableCell, { width: "16%" }]}>
                  {row.eventType}
                </Text>
                <Text style={[styles.tableCell, { width: "50%" }]}>
                  {row.description}
                </Text>
                <Text style={[styles.tableCell, { width: "16%" }]}>
                  {row.actor}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

// ============================================================================
// REPORT 6: STUDENT ACTIVITY
// ============================================================================

export function StudentActivityPDF({
  data,
  rangeLabel,
}: {
  data: Array<{
    studentName: string;
    idNumber: string;
    department: string;
    section: string;
    plotsAssigned: number;
    observationsInRange: number;
    totalObservations: number;
    photoCount: number;
    lastLogAt: Date | null;
  }>;
  rangeLabel: string;
}) {
  const meta = [
    `Time range: ${rangeLabel}`,
    `Total students: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const cols = [
    { label: "Student", width: "20%" },
    { label: "ID Number", width: "12%" },
    { label: "Department", width: "14%" },
    { label: "Section", width: "8%" },
    { label: "Plots", width: "7%" },
    { label: "Logs (range)", width: "11%" },
    { label: "Total Logs", width: "10%" },
    { label: "Photos", width: "8%" },
    { label: "Last Log", width: "10%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportHeader title="Student Activity Report" meta={meta} />

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No student farmers found.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {cols.map((c, i) => (
                <Text
                  key={i}
                  style={[styles.tableHeaderCell, { width: c.width }]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {data.map((row, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  {row.studentName}
                </Text>
                <Text style={[styles.tableCell, { width: "12%" }]}>
                  {row.idNumber}
                </Text>
                <Text style={[styles.tableCell, { width: "14%" }]}>
                  {row.department}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.section}
                </Text>
                <Text style={[styles.tableCell, { width: "7%" }]}>
                  {row.plotsAssigned}
                </Text>
                <Text style={[styles.tableCell, { width: "11%" }]}>
                  {row.observationsInRange}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.totalObservations}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.photoCount}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatDate(row.lastLogAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}