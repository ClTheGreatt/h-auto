import ExcelJS from "exceljs";
import { BRANDING } from "./branding";
import {
  loadReportBrandingAssets,
  type ReportBrandingAssets,
} from "./branding-assets";
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
import { trustedCloudinaryUrl } from "./growth-log-media";
import type { AlertReportRow } from "./alert-notifications";

// =============================================================
// SHARED HELPERS
// =============================================================

function applyBranding(workbook: ExcelJS.Workbook, generatedAt: Date) {
  workbook.creator = BRANDING.systemName;
  workbook.lastModifiedBy = BRANDING.systemName;
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF166534" },
  };
  row.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  row.height = 34;
}

function toExcelImageBuffer(buffer: Buffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes.buffer;
}

function addTitleRows(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  reportTitle: string,
  meta: string[],
  reportColumnCount: number,
  assets: ReportBrandingAssets,
  summary: ReportSummary
) {
  const brandingWidth = Math.max(8, reportColumnCount);
  const centerStartColumn = 2;
  const centerEndColumn = brandingWidth - 1;
  const brandingRows = [
    {
      value: BRANDING.universityName.toUpperCase(),
      font: { bold: true, size: 13, color: { argb: "FF1F2937" } },
      height: 22,
    },
    {
      value: BRANDING.campusName,
      font: { size: 10, color: { argb: "FF374151" } },
      height: 18,
    },
    {
      value: BRANDING.collegeName,
      font: { size: 10, color: { argb: "FF374151" } },
      height: 18,
    },
    {
      value: BRANDING.systemName.toUpperCase(),
      font: { bold: true, size: 13, color: { argb: "FF166534" } },
      height: 22,
    },
    {
      value: BRANDING.systemSubtitle,
      font: { italic: true, size: 9, color: { argb: "FF4B5563" } },
      height: 22,
    },
  ] as const;

  for (const [index, brandingRow] of brandingRows.entries()) {
    const rowNumber = index + 1;
    sheet.mergeCells(
      rowNumber,
      centerStartColumn,
      rowNumber,
      centerEndColumn
    );
    const cell = sheet.getCell(rowNumber, centerStartColumn);
    cell.value = brandingRow.value;
    cell.font = brandingRow.font;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    sheet.getRow(rowNumber).height = brandingRow.height;
  }

  const sealImageId = workbook.addImage({
    buffer: toExcelImageBuffer(assets.bpsuSeal),
    extension: "png",
  });
  const agricultureImageId = workbook.addImage({
    buffer: toExcelImageBuffer(assets.agricultureEmblem),
    extension: "png",
  });
  sheet.addImage(sealImageId, {
    tl: { col: 0.15, row: 1.1 },
    ext: { width: (60 * 275) / 363, height: 60 },
    editAs: "oneCell",
  });
  sheet.addImage(agricultureImageId, {
    tl: { col: brandingWidth - 0.95, row: 1.1 },
    ext: { width: 60, height: 60 },
    editAs: "oneCell",
  });

  const reportTitleRow = 6;
  sheet.mergeCells(reportTitleRow, 1, reportTitleRow, brandingWidth);
  const titleCell = sheet.getCell(reportTitleRow, 1);
  titleCell.value = reportTitle.toUpperCase();
  titleCell.font = { bold: true, size: 14, color: { argb: "FF111827" } };
  titleCell.alignment = { vertical: "middle" };
  titleCell.border = {
    top: { style: "medium", color: { argb: "FF166534" } },
  };
  sheet.getRow(reportTitleRow).height = 25;

  let row = reportTitleRow + 1;
  for (const m of meta) {
    sheet.mergeCells(row, 1, row, brandingWidth);
    sheet.getCell(row, 1).value = m;
    sheet.getCell(row, 1).font = { size: 9, color: { argb: "FF6B7280" } };
    sheet.getCell(row, 1).alignment = { vertical: "middle", wrapText: true };
    row++;
  }

  sheet.mergeCells(row, 1, row, brandingWidth);
  const summaryTitle = sheet.getCell(row, 1);
  summaryTitle.value = "REPORT SUMMARY";
  summaryTitle.font = {
    bold: true,
    size: 10,
    color: { argb: "FF166534" },
  };
  summaryTitle.border = {
    top: { style: "thin", color: { argb: "FF166534" } },
  };
  sheet.getRow(row).height = 20;
  row++;

  for (const item of summary.items) {
    sheet.mergeCells(row, 1, row, 3);
    sheet.mergeCells(row, 4, row, brandingWidth);
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = item.label;
    labelCell.font = { bold: true, size: 9, color: { argb: "FF374151" } };
    const valueCell = sheet.getCell(row, 4);
    valueCell.value = item.value;
    valueCell.font = { size: 9, color: { argb: "FF4B5563" } };
    valueCell.alignment = { horizontal: "left", vertical: "middle" };
    sheet.getRow(row).height = 18;
    row++;
  }

  if (summary.table && summary.table.rows.length > 0) {
    const { headers, rows } = summary.table;
    sheet.getRow(row).values = headers;
    for (let column = 1; column <= headers.length; column++) {
      const cell = sheet.getCell(row, column);
      cell.font = { bold: true, size: 9, color: { argb: "FF166534" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F3EB" },
      };
    }
    sheet.getRow(row).height = 20;
    row++;
    for (const values of rows) {
      sheet.getRow(row).values = values;
      sheet.getRow(row).height = 17;
      row++;
    }
  }

  sheet.getRow(row).height = 8; // spacer
  return row + 1; // first row for headers
}

function configureWorksheet(
  sheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  reportColumnCount: number,
  orientation: "landscape" | "portrait"
) {
  const lastDataColumn = sheet.getColumn(reportColumnCount).letter;
  sheet.views = [
    {
      state: "frozen",
      ySplit: headerRowIndex,
      topLeftCell: `A${headerRowIndex + 1}`,
      showGridLines: false,
    },
  ];
  sheet.autoFilter = `A${headerRowIndex}:${lastDataColumn}${headerRowIndex}`;
  sheet.pageSetup = {
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${headerRowIndex}:${headerRowIndex}`,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
}

// =============================================================
// REPORT 1: SENSOR READINGS
// =============================================================

export async function generateSensorReadingsExcel(
  data: Array<{
    recordedAt: Date;
    plotName: string;
    plotLocation: string;
    deviceCode: string;
    soilMoisture: number | null;
    temperature: number | null;
    humidity: number | null;
    lightIntensity: number | null;
    nitrogen: number | null;
    phosphorus: number | null;
    potassium: number | null;
  }> & { truncated: boolean },
  rangeLabel: string,
  plotName: string | undefined,
  exportContext: ReportExportContext
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb, exportContext.generatedAt);
  const sheet = wb.addWorksheet("Sensor Readings");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Included readings: ${data.length}`,
    ...(data.truncated
      ? ["Most recent 5,000 records shown; additional matching records omitted."]
      : []),
    ...getReportExportMetadata(exportContext).map((item) => `${item.label}: ${item.value}`),
  ];

  const headers = [
    "Date / Time",
    "Plot",
    "Location",
    "Device",
    "Soil Moisture (%)",
    "Temperature (°C)",
    "Humidity (%)",
    "Light (lux)",
    "Nitrogen (mg/kg)",
    "Phosphorus (mg/kg)",
    "Potassium (mg/kg)",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Sensor Readings Report",
    meta,
    headers.length,
    assets,
    summarizeSensorReadings(data)
  );
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  // Set widths
  sheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 28 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
    sheet.getRow(row).values = [
      formatDateTime(r.recordedAt),
      r.plotName,
      r.plotLocation,
      r.deviceCode,
      r.soilMoisture,
      r.temperature,
      r.humidity,
      r.lightIntensity,
      r.nitrogen,
      r.phosphorus,
      r.potassium,
    ];
    if (row % 2 === 0) {
      sheet.getRow(row).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    }
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
    row++;
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "landscape");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// =============================================================
// REPORT 2: PLOT PERFORMANCE
// =============================================================

export async function generatePlotPerformanceExcel(
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
  }>,
  rangeLabel: string,
  exportContext: ReportExportContext
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb, exportContext.generatedAt);
  const sheet = wb.addWorksheet("Plot Performance");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total plots: ${data.length}`,
    ...getReportExportMetadata(exportContext).map((item) => `${item.label}: ${item.value}`),
  ];

  const headers = [
    "Plot",
    "Location",
    "Crop",
    "Variety",
    "Current Stage",
    "Status",
    "Planted",
    "Expected Harvest",
    "Sensor Readings",
    "Growth Logs",
    "Alerts (range)",
    "Current Open Alerts",
    "Current Active Assignments",
    "Latest Height (cm)",
    "Latest Leaf Count",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Plot Performance Report",
    meta,
    headers.length,
    assets,
    summarizePlotPerformance(data)
  );
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  sheet.columns = [
    { width: 14 },
    { width: 20 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
    sheet.getRow(row).values = [
      r.plotName,
      r.location,
      r.crop,
      r.variety,
      r.stage,
      r.status,
      formatDate(r.plantingDate),
      formatDate(r.expectedHarvest),
      r.readingCount,
      r.logCount,
      r.alertCount,
      r.openAlertCount,
      r.activeAssignments,
      r.latestHeight,
      r.latestLeafCount,
    ];
    if (row % 2 === 0) {
      sheet.getRow(row).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    }
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
    row++;
  }

  if (data.length > 0) {
    sheet.mergeCells(row, 1, row, 15);
    const noteCell = sheet.getCell(row, 1);
    noteCell.value =
      "Current snapshot (not time-range-scoped): Crop, Variety, Stage, Status, Planting and Harvest Dates, Open Alerts, Active Assignments, Latest Height, Latest Leaf Count.";
    noteCell.font = { size: 9, color: { argb: "FF6B7280" } };
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "landscape");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// =============================================================
// REPORT 3: GROWTH LOG
// =============================================================

export async function generateGrowthLogExcel(
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
  }>,
  rangeLabel: string,
  plotName: string | undefined,
  exportContext: ReportExportContext
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb, exportContext.generatedAt);
  const sheet = wb.addWorksheet("Growth Log");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total entries: ${data.length}`,
    ...getReportExportMetadata(exportContext).map((item) => `${item.label}: ${item.value}`),
  ];

  const headers = [
    "Date / Time",
    "Plot",
    "Stage",
    "Author",
    "Height (cm)",
    "Leaf Count",
    "Observations",
    "Notes",
    "Photo Count",
    "Photo",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Growth Log Report",
    meta,
    headers.length,
    assets,
    summarizeGrowthLogs(data)
  );
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  sheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 20 },
    { width: 12 },
    { width: 12 },
    { width: 50 },
    { width: 40 },
    { width: 10 },
    { width: 19 },
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
    const trustedFirstPhoto = trustedCloudinaryUrl(r.imageUrls?.[0]);
    sheet.getRow(row).values = [
      formatDateTime(r.createdAt),
      r.plotName,
      r.stageName,
      r.authorName,
      r.plantHeightCm,
      r.leafCount,
      r.observations,
      r.notes,
      r.imageCount,
      r.imageCount === 0
        ? "—"
        : trustedFirstPhoto
          ? { text: r.imageCount === 1 ? "View photo" : "View first photo", hyperlink: trustedFirstPhoto }
          : "Unavailable",
    ];
    if (trustedFirstPhoto && r.imageCount > 0) {
      sheet.getCell(row, 10).font = {
        color: { argb: "FF0563C1" },
        underline: true,
      };
    }
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
    if (row % 2 === 0) {
      sheet.getRow(row).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    }
    row++;
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "landscape");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// =============================================================
// REPORT 4: ALERTS
// =============================================================

function addAlertNotificationsSheet(wb: ExcelJS.Workbook, data: AlertReportRow[]) {
  const detail = wb.addWorksheet("Alert Notifications");
  const detailHeaders = [
    "Alert Date",
    "Plot",
    "Alert Type",
    "Severity",
    "Recipient",
    "Channel",
    "Status",
  ];
  detail.mergeCells(1, 1, 1, detailHeaders.length);
  const detailTitle = detail.getCell(1, 1);
  detailTitle.value = "ALERT NOTIFICATIONS";
  detailTitle.font = { bold: true, size: 13, color: { argb: "FF166534" } };
  detailTitle.alignment = { vertical: "middle" };
  detail.getRow(1).height = 26;
  const detailHeaderRow = 2;
  detail.getRow(detailHeaderRow).values = detailHeaders;
  styleHeaderRow(detail.getRow(detailHeaderRow));
  detail.columns = [
    { width: 22 },
    { width: 14 },
    { width: 24 },
    { width: 12 },
    { width: 26 },
    { width: 12 },
    { width: 14 },
  ];

  let detailRow = detailHeaderRow + 1;
  for (const alert of data) {
    for (const notification of alert.notificationDetails) {
      detail.getRow(detailRow).values = [
        formatDateTime(alert.createdAt),
        alert.plotName,
        alert.type,
        alert.severity,
        notification.recipient,
        notification.channel,
        notification.status,
      ];
      detail.getRow(detailRow).alignment = { vertical: "top", wrapText: true };
      detailRow++;
    }
  }
  configureWorksheet(detail, detailHeaderRow, detailHeaders.length, "landscape");
}

export async function generateAlertsExcel(
  data: AlertReportRow[],
  rangeLabel: string,
  plotName: string | undefined,
  exportContext: ReportExportContext
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb, exportContext.generatedAt);
  const sheet = wb.addWorksheet("Alerts");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total alerts: ${data.length}`,
    `Open: ${data.filter((a) => !a.resolved).length}`,
    `Resolved: ${data.filter((a) => a.resolved).length}`,
    ...getReportExportMetadata(exportContext).map((item) => `${item.label}: ${item.value}`),
  ];

  const headers = [
    "Date / Time",
    "Plot",
    "Type",
    "Severity",
    "Message",
    "Status",
    "Resolved At",
    "Sent Records",
    "Failed Records",
    "Recipient Users",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Alerts Report",
    meta,
    headers.length,
    assets,
    summarizeAlerts(data)
  );
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  sheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 24 },
    { width: 12 },
    { width: 50 },
    { width: 12 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
    sheet.getRow(row).values = [
      formatDateTime(r.createdAt),
      r.plotName,
      r.type,
      r.severity,
      r.message,
      r.resolved ? "Resolved" : "Open",
      formatDateTime(r.resolvedAt),
      r.sentNotificationRecords,
      r.failedNotificationRecords,
      r.recipientUsers,
    ];

    // Color severity cell
    const severityCell = sheet.getCell(row, 4);
    if (r.severity === "CRITICAL") {
      severityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
      severityCell.font = { color: { argb: "FF991B1B" }, bold: true };
    } else if (r.severity === "WARNING") {
      severityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      };
      severityCell.font = { color: { argb: "FF92400E" }, bold: true };
    }

    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
    row++;
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "landscape");
  addAlertNotificationsSheet(wb, data);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// =============================================================
// REPORT 5: SYSTEM ACTIVITY
// =============================================================

export async function generateActivityExcel(
  data: Array<{
    timestamp: Date;
    eventType: string;
    description: string;
    actor: string;
  }> & { truncated: boolean },
  rangeLabel: string,
  exportContext: ReportExportContext
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb, exportContext.generatedAt);
  const sheet = wb.addWorksheet("System Activity");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total events: ${data.length}`,
    ...(data.truncated
      ? ["Showing only the most recent 100 records per event type."]
      : []),
    ...getReportExportMetadata(exportContext).map((item) => `${item.label}: ${item.value}`),
  ];

  const headers = ["Timestamp", "Event Type", "Description", "Actor"];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "System Activity Report",
    meta,
    headers.length,
    assets,
    summarizeActivity(data)
  );
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  sheet.columns = [
    { width: 22 },
    { width: 20 },
    { width: 60 },
    { width: 24 },
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
    sheet.getRow(row).values = [
      formatDateTime(r.timestamp),
      r.eventType,
      r.description,
      r.actor,
    ];
    if (row % 2 === 0) {
      sheet.getRow(row).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    }
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
    row++;
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "portrait");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// =============================================================
// REPORT 6: STUDENT ACTIVITY
// =============================================================

export async function generateStudentActivityExcel(
  data: Array<{
    studentName: string;
    idNumber: string;
    section: string;
    plotsAssigned: number;
    observationsInRange: number;
    totalObservations: number;
    photoCount: number;
    lastLogAt: Date | null;
  }>,
  rangeLabel: string,
  exportContext: ReportExportContext
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb, exportContext.generatedAt);
  const sheet = wb.addWorksheet("Student Activity");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total students: ${data.length}`,
    ...getReportExportMetadata(exportContext).map((item) => `${item.label}: ${item.value}`),
  ];

  const headers = [
    "Student",
    "ID Number",
    "Section",
    "Current Active Assignments",
    "Observations (range)",
    "Total Observations",
    "Photos (range)",
    "Last Log",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Student Activity Report",
    meta,
    headers.length,
    assets,
    summarizeStudentActivity(data)
  );
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  sheet.columns = [
    { width: 24 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
    { width: 20 },
    { width: 18 },
    { width: 12 },
    { width: 16 },
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
    sheet.getRow(row).values = [
      r.studentName,
      r.idNumber,
      r.section,
      r.plotsAssigned,
      r.observationsInRange,
      r.totalObservations,
      r.photoCount,
      formatDate(r.lastLogAt),
    ];
    if (row % 2 === 0) {
      sheet.getRow(row).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    }
    row++;
  }

  if (data.length > 0) {
    sheet.mergeCells(row, 1, row, 8);
    const noteCell = sheet.getCell(row, 1);
    noteCell.value =
      "Current active assignments are not time-range-scoped. Total observations and last log are lifetime within report access.";
    noteCell.font = { size: 9, color: { argb: "FF6B7280" } };
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "landscape");

  return Buffer.from(await wb.xlsx.writeBuffer());
}
