import ExcelJS from "exceljs";
import { BRANDING } from "./branding";
import {
  loadReportBrandingAssets,
  type ReportBrandingAssets,
} from "./branding-assets";
import { formatDate, formatDateTime } from "@/lib/format-date";

// =============================================================
// SHARED HELPERS
// =============================================================

function applyBranding(workbook: ExcelJS.Workbook) {
  workbook.creator = BRANDING.systemName;
  workbook.lastModifiedBy = BRANDING.systemName;
  workbook.created = new Date();
  workbook.modified = new Date();
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
  assets: ReportBrandingAssets
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
  plotName?: string
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb);
  const sheet = wb.addWorksheet("Sensor Readings");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Included readings: ${data.length}`,
    ...(data.truncated
      ? ["Most recent 5,000 records shown; additional matching records omitted."]
      : []),
    `Generated: ${formatDateTime(new Date())}`,
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
    assets
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
  rangeLabel: string
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb);
  const sheet = wb.addWorksheet("Plot Performance");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total plots: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
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
    "Total Alerts",
    "Open Alerts",
    "Active Assignments",
    "Latest Height (cm)",
    "Latest Leaf Count",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Plot Performance Report",
    meta,
    headers.length,
    assets
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
      "Lifetime (not time-range-scoped): Open Alerts, Active Assignments, Latest Height, Latest Leaf Count.";
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
  }>,
  rangeLabel: string,
  plotName?: string
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb);
  const sheet = wb.addWorksheet("Growth Log");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total entries: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
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
    "Photos",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Growth Log Report",
    meta,
    headers.length,
    assets
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
  ];

  let row = headerRowIndex + 1;
  for (const r of data) {
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
    ];
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

export async function generateAlertsExcel(
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
  }>,
  rangeLabel: string,
  plotName?: string
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb);
  const sheet = wb.addWorksheet("Alerts");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total alerts: ${data.length}`,
    `Open: ${data.filter((a) => !a.resolved).length}`,
    `Resolved: ${data.filter((a) => a.resolved).length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headers = [
    "Date / Time",
    "Plot",
    "Type",
    "Severity",
    "Message",
    "Status",
    "Resolved At",
    "SMS Sent",
    "SMS Failed",
    "Recipients",
  ];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "Alerts Report",
    meta,
    headers.length,
    assets
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
    { width: 12 },
    { width: 12 },
    { width: 30 },
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
      r.notificationsSent,
      r.notificationsFailed,
      r.recipients,
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
  rangeLabel: string
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb);
  const sheet = wb.addWorksheet("System Activity");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total events: ${data.length}`,
    ...(data.truncated
      ? ["Showing only the most recent 100 records per event type."]
      : []),
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headers = ["Timestamp", "Event Type", "Description", "Actor"];
  const headerRowIndex = addTitleRows(
    wb,
    sheet,
    "System Activity Report",
    meta,
    headers.length,
    assets
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
  rangeLabel: string
) {
  const wb = new ExcelJS.Workbook();
  applyBranding(wb);
  const sheet = wb.addWorksheet("Student Activity");
  const assets = await loadReportBrandingAssets();

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total students: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headers = [
    "Student",
    "ID Number",
    "Section",
    "Plots Assigned",
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
    assets
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
      "Lifetime (not time-range-scoped): Plots Assigned, Total Observations, Last Log.";
    noteCell.font = { size: 9, color: { argb: "FF6B7280" } };
  }

  configureWorksheet(sheet, headerRowIndex, headers.length, "landscape");
  return Buffer.from(await wb.xlsx.writeBuffer());
}
