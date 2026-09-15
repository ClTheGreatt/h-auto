import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { BRANDING } from "./branding";
import type { ReportBrandingAssets } from "./branding-assets";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  getReportExportMetadata,
  type ReportExportContext,
} from "./export-context";
import {
  summarizeActivity,
  summarizeAlerts,
  summarizeGrowthLogs,
  summarizePlotPerformance,
  summarizeSensorReadings,
  summarizeStudentActivity,
  type ReportSummary,
} from "./summaries";
import { MAX_GROWTH_LOG_PHOTOS, type GrowthLogPhotoEvidence } from "./growth-log-media";
import type { AlertReportRow } from "./alert-notifications";

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingHorizontal: 36,
    paddingBottom: 44,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  // Header
  header: {
    marginTop: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: BRANDING.primaryColor,
    paddingBottom: 10,
    marginBottom: 12,
  },
  institutionalRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },
  logoSlot: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  sealLogo: { width: 42, height: 56, objectFit: "contain" },
  agricultureLogo: { width: 56, height: 56, objectFit: "contain" },
  institutionalText: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  universityName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
    textTransform: "uppercase",
  },
  campusName: { fontSize: 9, color: "#374151", marginTop: 2 },
  collegeName: { fontSize: 9, color: "#374151", marginTop: 1 },
  systemName: {
    fontSize: 13,
    fontWeight: "bold",
    color: BRANDING.primaryColor,
    marginTop: 7,
    textTransform: "uppercase",
  },
  systemSubtitle: {
    fontSize: 7.5,
    color: "#4b5563",
    marginTop: 2,
    textAlign: "center",
  },
  // Title
  reportTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 7,
    color: "#111827",
    textTransform: "uppercase",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  metaItem: {
    width: "50%",
    flexDirection: "row",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  metaLabel: {
    width: 72,
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
  },
  metaValue: { flex: 1, fontSize: 8, color: "#4b5563" },
  metaNote: {
    width: "100%",
    paddingHorizontal: 4,
    marginTop: 1,
    fontSize: 7.5,
    color: "#6b7280",
  },
  continuationHeader: {
    position: "absolute",
    top: 9,
    left: 36,
    right: 36,
    height: 29,
  },
  continuationHeaderContent: {
    height: 29,
    borderBottomWidth: 1,
    borderBottomColor: BRANDING.primaryColor,
    alignItems: "center",
  },
  continuationUniversity: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#374151",
  },
  continuationTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: BRANDING.primaryColor,
    marginTop: 2,
  },
  continuationTableHeader: {
    position: "absolute",
    top: 40,
    left: 36,
    right: 36,
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
  numericCell: { textAlign: "center" },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
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
  scopeNote: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 8,
  },
  summary: { marginBottom: 10 },
  summaryTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: BRANDING.primaryColor,
    marginBottom: 5,
  },
  summaryItems: { flexDirection: "row", flexWrap: "wrap" },
  summaryItem: { width: "50%", flexDirection: "row", marginBottom: 3 },
  summaryLabel: { fontSize: 7.5, fontWeight: "bold", color: "#374151" },
  summaryValue: { fontSize: 7.5, color: "#4b5563", marginLeft: 4, flex: 1 },
  summaryTable: { marginTop: 5 },
  summaryTableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  summaryTableHeading: { backgroundColor: "#e8f3eb" },
  summaryTableCell: { fontSize: 7.5, color: "#374151" },
  detailTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    marginTop: 4,
    marginBottom: 2,
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
  logPhotoLabel: { fontSize: 8, fontWeight: "bold", color: "#374151", marginBottom: 4 },
  logPhotoRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  logPhotoFrame: {
    width: "31%",
    height: 92,
    borderWidth: 0.5,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  logPhotoImage: { width: "100%", height: "100%", objectFit: "contain" },
  logPhotoUnavailable: { fontSize: 7.5, color: "#6b7280", textAlign: "center" },
  logMorePhotos: { fontSize: 7.5, color: "#6b7280", textAlign: "right", marginBottom: 5 },
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

type ReportMetadata = {
  label?: string;
  value: string;
  note?: boolean;
};

type TableColumn = { label: string; width: string };

function ReportSummaryBlock({ summary }: { summary: ReportSummary }) {
  const table = summary.table;
  const columnWidths =
    table?.headers.length === 5
      ? ["28%", "12%", "20%", "20%", "20%"]
      : ["70%", "30%"];
  return (
    <View style={styles.summary} wrap={false}>
      <Text style={styles.summaryTitle}>REPORT SUMMARY</Text>
      <View style={styles.summaryItems}>
        {summary.items.map((item) => (
          <View key={item.label} style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{item.label}:</Text>
            <Text style={styles.summaryValue}>{String(item.value)}</Text>
          </View>
        ))}
      </View>
      {table && table.rows.length > 0 && (
        <View style={styles.summaryTable}>
          <View style={[styles.summaryTableRow, styles.summaryTableHeading]}>
            {table.headers.map((header, index) => (
              <Text
                key={header}
                style={[
                  styles.summaryTableCell,
                  { width: columnWidths[index], fontWeight: "bold" },
                ]}
              >
                {header}
              </Text>
            ))}
          </View>
          {table.rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.summaryTableRow}>
              {row.map((value, index) => (
                <Text
                  key={index}
                  style={[styles.summaryTableCell, { width: columnWidths[index] }]}
                >
                  {String(value)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TableHeader({ columns }: { columns: TableColumn[] }) {
  return (
    <View style={styles.tableHeader}>
      {columns.map((column) => (
        <Text
          key={column.label}
          style={[styles.tableHeaderCell, { width: column.width }]}
        >
          {column.label}
        </Text>
      ))}
    </View>
  );
}

function ReportHeader({
  title,
  meta,
  assets,
}: {
  title: string;
  meta: ReportMetadata[];
  assets: ReportBrandingAssets;
}) {
  return (
    <View style={styles.header} wrap={false}>
      <View style={styles.institutionalRow}>
        <View style={styles.logoSlot}>
          {/* React-PDF Image does not expose the DOM alt attribute. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={assets.bpsuSeal} style={styles.sealLogo} />
        </View>
        <View style={styles.institutionalText}>
          <Text style={styles.universityName}>{BRANDING.universityName}</Text>
          <Text style={styles.campusName}>{BRANDING.campusName}</Text>
          <Text style={styles.collegeName}>{BRANDING.collegeName}</Text>
          <Text style={styles.systemName}>{BRANDING.systemName}</Text>
          <Text style={styles.systemSubtitle}>{BRANDING.systemSubtitle}</Text>
        </View>
        <View style={styles.logoSlot}>
          {/* React-PDF Image does not expose the DOM alt attribute. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={assets.agricultureEmblem}
            style={styles.agricultureLogo}
          />
        </View>
      </View>
      <Text style={styles.reportTitle}>{title}</Text>
      <View style={styles.metaGrid}>
        {meta.map((item) =>
          item.note ? (
            <Text key={item.value} style={styles.metaNote}>
              {item.value}
            </Text>
          ) : (
            <View key={`${item.label}-${item.value}`} style={styles.metaItem}>
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}

function ReportPageChrome({
  title,
  columns,
}: {
  title: string;
  columns?: TableColumn[];
}) {
  return (
    <>
      <View
        fixed
        style={styles.continuationHeader}
        render={({ pageNumber }) =>
          pageNumber > 1 ? (
            <View style={styles.continuationHeaderContent}>
              <Text style={styles.continuationUniversity}>
                {BRANDING.universityName} | {BRANDING.systemName}
              </Text>
              <Text style={styles.continuationTitle}>{title}</Text>
            </View>
          ) : null
        }
      />
      {columns ? (
        <View
          fixed
          style={styles.continuationTableHeader}
          render={({ pageNumber }) =>
            pageNumber > 1 ? <TableHeader columns={columns} /> : null
          }
        />
      ) : null}
      <ReportFooter />
    </>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>{BRANDING.systemName} | Confidential Report</Text>
      <Text
        style={{ width: 60, textAlign: "right" }}
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
  assets,
  exportContext,
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
  }> & { truncated: boolean };
  rangeLabel: string;
  plotName?: string;
  assets: ReportBrandingAssets;
  exportContext: ReportExportContext;
}) {
  const meta = [
    { label: "Time Range", value: rangeLabel },
    { label: "Plot Filter", value: plotName ?? "All plots" },
    { label: "Included readings", value: String(data.length) },
    ...(data.truncated
      ? [
          {
            value:
              "Most recent 5,000 records shown; additional matching records omitted.",
            note: true,
          },
        ]
      : []),
    ...getReportExportMetadata(exportContext),
  ] satisfies ReportMetadata[];

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
        <ReportPageChrome title="Sensor Readings Report" columns={cols} />
        <ReportHeader
          title="Sensor Readings Report"
          meta={meta}
          assets={assets}
        />
        <ReportSummaryBlock summary={summarizeSensorReadings(data)} />
        <Text style={styles.detailTitle}>DETAILED DATA</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No sensor readings found for the selected filters.
          </Text>
        ) : (
          <View style={styles.table}>
            <TableHeader columns={cols} />
            {data.map((row, i) => (
              <View
                key={i}
                wrap={false}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "16%" }]}>
                  {formatDateTime(row.recordedAt)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {row.plotName}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {fmt(row.soilMoisture)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "9%" }]}
                >
                  {fmt(row.temperature)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {fmt(row.humidity)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "10%" }]}
                >
                  {fmt(row.lightIntensity, 0)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {fmt(row.nitrogen, 0)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {fmt(row.phosphorus, 0)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {fmt(row.potassium, 0)}
                </Text>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  {row.deviceCode}
                </Text>
              </View>
            ))}
          </View>
        )}

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
  assets,
  exportContext,
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
  assets: ReportBrandingAssets;
  exportContext: ReportExportContext;
}) {
  const meta = [
    { label: "Time Range", value: rangeLabel },
    { label: "Total Plots", value: String(data.length) },
    ...getReportExportMetadata(exportContext),
  ] satisfies ReportMetadata[];

  const cols = [
    { label: "Plot", width: "8%" },
    { label: "Crop / Variety", width: "12%" },
    { label: "Stage", width: "8%" },
    { label: "Status", width: "8%" },
    { label: "Planted", width: "10%" },
    { label: "Harvest", width: "10%" },
    { label: "Readings", width: "8%" },
    { label: "Logs", width: "6%" },
    { label: "Alerts (range)", width: "10%" },
    { label: "Open (current)", width: "10%" },
    { label: "Latest H/L", width: "10%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportPageChrome title="Plot Performance Report" columns={cols} />
        <ReportHeader
          title="Plot Performance Report"
          meta={meta}
          assets={assets}
        />
        <ReportSummaryBlock summary={summarizePlotPerformance(data)} />
        <Text style={styles.detailTitle}>DETAILED DATA</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyState}>No plot data available.</Text>
        ) : (
          <View style={styles.table}>
            <TableHeader columns={cols} />
            {data.map((row, i) => (
              <View
                key={i}
                wrap={false}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.plotName}
                </Text>
                <Text style={[styles.tableCell, { width: "12%" }]}>
                  {row.crop} / {row.variety}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.stage}
                </Text>
                <Text style={[styles.tableCell, { width: "8%" }]}>
                  {row.status}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatDate(row.plantingDate)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatDate(row.expectedHarvest)}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {row.readingCount}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "6%" }]}
                >
                  {row.logCount}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "10%" }]}
                >
                  {row.alertCount}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "10%" }]}
                >
                  {row.openAlertCount}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "10%" }]}
                >
                  {row.latestHeight != null ? `${row.latestHeight}cm` : "-"}
                  {row.latestLeafCount != null
                    ? ` / ${row.latestLeafCount} leaves`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data.length > 0 && (
          <Text style={styles.scopeNote}>
            Current snapshot (not time-range-scoped): crop, stage, status,
            planting and harvest dates, open alerts, latest height and leaf count.
          </Text>
        )}

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
  assets,
  exportContext,
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
    imageUrls?: string[];
    photoEvidence?: GrowthLogPhotoEvidence[];
  }>;
  rangeLabel: string;
  plotName?: string;
  assets: ReportBrandingAssets;
  exportContext: ReportExportContext;
}) {
  const meta = [
    { label: "Time Range", value: rangeLabel },
    { label: "Plot Filter", value: plotName ?? "All plots" },
    { label: "Total Entries", value: String(data.length) },
    ...getReportExportMetadata(exportContext),
  ] satisfies ReportMetadata[];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportPageChrome title="Growth Log Report" />
        <ReportHeader title="Growth Log Report" meta={meta} assets={assets} />
        <ReportSummaryBlock summary={summarizeGrowthLogs(data)} />
        <Text style={styles.detailTitle}>DETAILED DATA</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No growth log entries found for the selected filters.
          </Text>
        ) : (
          data.map((log, i) => (
            <View key={i} style={styles.logEntry}>
              <View wrap={false}>
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
                {log.imageCount > 0 && (
                  <View>
                    <Text style={styles.logPhotoLabel}>
                      {log.imageCount === 1 ? "Photo" : "Photos"}
                    </Text>
                    <View style={styles.logPhotoRow} wrap={false}>
                      {Array.from({ length: Math.min(log.imageCount, MAX_GROWTH_LOG_PHOTOS) }, (_, index) => (
                        <View key={index} style={styles.logPhotoFrame} wrap={false}>
                          {log.photoEvidence?.[index]?.src ? (
                            /* React PDF Image does not expose an alt prop. */
                            // eslint-disable-next-line jsx-a11y/alt-text
                            <Image src={log.photoEvidence[index].src} style={styles.logPhotoImage} />
                          ) : (
                            <Text style={styles.logPhotoUnavailable}>
                              {log.photoEvidence?.[index]?.omittedFromPdfLimit
                                ? "Photo omitted from PDF export limit"
                                : "Photo unavailable"}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                    {log.imageCount > MAX_GROWTH_LOG_PHOTOS && (
                      <Text style={styles.logMorePhotos}>
                        +{log.imageCount - MAX_GROWTH_LOG_PHOTOS} more photos
                      </Text>
                    )}
                  </View>
                )}
              </View>
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
  assets,
  exportContext,
}: {
  data: AlertReportRow[];
  rangeLabel: string;
  plotName?: string;
  assets: ReportBrandingAssets;
  exportContext: ReportExportContext;
}) {
  const meta = [
    { label: "Time Range", value: rangeLabel },
    { label: "Plot Filter", value: plotName ?? "All plots" },
    { label: "Total Alerts", value: String(data.length) },
    { label: "Open", value: String(data.filter((a) => !a.resolved).length) },
    { label: "Resolved", value: String(data.filter((a) => a.resolved).length) },
    ...getReportExportMetadata(exportContext),
  ] satisfies ReportMetadata[];

  const cols = [
    { label: "Date", width: "14%" },
    { label: "Plot", width: "10%" },
    { label: "Severity", width: "10%" },
    { label: "Message", width: "32%" },
    { label: "Status", width: "10%" },
    { label: "Notifications", width: "14%" },
    { label: "Recipient Users", width: "10%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportPageChrome title="Alerts Report" columns={cols} />
        <ReportHeader title="Alerts Report" meta={meta} assets={assets} />
        <ReportSummaryBlock summary={summarizeAlerts(data)} />
        <Text style={styles.detailTitle}>DETAILED DATA</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No alerts found for the selected filters.
          </Text>
        ) : (
          <View style={styles.table}>
            <TableHeader columns={cols} />
            {data.map((row, i) => (
              <View
                key={i}
                wrap={false}
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
                <Text
                  style={[styles.tableCell, { width: "14%" }]}
                >
                  {`${row.sentNotificationRecords} sent / ${row.failedNotificationRecords} failed`}
                </Text>
                <Text style={[styles.tableCell, styles.numericCell, { width: "10%" }]}>
                  {row.recipientUsers}
                </Text>
              </View>
            ))}
          </View>
        )}

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
  assets,
  exportContext,
}: {
  data: Array<{
    timestamp: Date;
    eventType: string;
    description: string;
    actor: string;
  }> & { truncated: boolean };
  rangeLabel: string;
  assets: ReportBrandingAssets;
  exportContext: ReportExportContext;
}) {
  const meta = [
    { label: "Time Range", value: rangeLabel },
    { label: "Total Events", value: String(data.length) },
    ...(data.truncated
      ? [
          {
            value: "Showing only the most recent 100 records per event type.",
            note: true,
          },
        ]
      : []),
    ...getReportExportMetadata(exportContext),
  ] satisfies ReportMetadata[];

  const cols = [
    { label: "Timestamp", width: "18%" },
    { label: "Event Type", width: "16%" },
    { label: "Description", width: "50%" },
    { label: "Actor", width: "16%" },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportPageChrome title="System Activity Report" columns={cols} />
        <ReportHeader
          title="System Activity Report"
          meta={meta}
          assets={assets}
        />
        <ReportSummaryBlock summary={summarizeActivity(data)} />
        <Text style={styles.detailTitle}>DETAILED DATA</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No events included for the selected scope.
          </Text>
        ) : (
          <View style={styles.table}>
            <TableHeader columns={cols} />
            {data.map((row, i) => (
              <View
                key={i}
                wrap={false}
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
  assets,
  exportContext,
}: {
  data: Array<{
    studentName: string;
    idNumber: string;
    section: string;
    plotsAssigned: number;
    observationsInRange: number;
    totalObservations: number;
    photoCount: number;
    lastLogAt: Date | null;
  }>;
  rangeLabel: string;
  assets: ReportBrandingAssets;
  exportContext: ReportExportContext;
}) {
  const meta = [
    { label: "Time Range", value: rangeLabel },
    { label: "Total Students", value: String(data.length) },
    ...getReportExportMetadata(exportContext),
  ] satisfies ReportMetadata[];

  const cols = [
    { label: "Student", width: "18%" },
    { label: "ID Number", width: "14%" },
    { label: "Section", width: "9%" },
    { label: "Active plots", width: "8%" },
    { label: "Logs (range)", width: "13%" },
    { label: "Total Logs", width: "12%" },
    { label: "Photos (range)", width: "13%" },
    { label: "Last Log", width: "13%" },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportPageChrome title="Student Activity Report" columns={cols} />
        <ReportHeader
          title="Student Activity Report"
          meta={meta}
          assets={assets}
        />
        <ReportSummaryBlock summary={summarizeStudentActivity(data)} />
        <Text style={styles.detailTitle}>DETAILED DATA</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyState}>
            No student farmers found.
          </Text>
        ) : (
          <View style={styles.table}>
            <TableHeader columns={cols} />
            {data.map((row, i) => (
              <View
                key={i}
                wrap={false}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { width: "18%" }]}>
                  {row.studentName}
                </Text>
                <Text style={[styles.tableCell, { width: "14%" }]}>
                  {row.idNumber}
                </Text>
                <Text style={[styles.tableCell, { width: "9%" }]}>
                  {row.section}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "8%" }]}
                >
                  {row.plotsAssigned}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "13%" }]}
                >
                  {row.observationsInRange}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "12%" }]}
                >
                  {row.totalObservations}
                </Text>
                <Text
                  style={[styles.tableCell, styles.numericCell, { width: "13%" }]}
                >
                  {row.photoCount}
                </Text>
                <Text style={[styles.tableCell, { width: "13%" }]}>
                  {formatDate(row.lastLogAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data.length > 0 && (
          <Text style={styles.scopeNote}>
            Current active assignments are not time-range-scoped.
            Total logs and last log are lifetime within report access.
          </Text>
        )}

      </Page>
    </Document>
  );
}
