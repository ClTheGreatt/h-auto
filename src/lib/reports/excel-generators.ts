import ExcelJS from "exceljs";
import { BRANDING } from "./branding";
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
    fgColor: { argb: "FF22C55E" },
  };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 24;
}

function addTitleRows(
  sheet: ExcelJS.Worksheet,
  reportTitle: string,
  meta: string[]
) {
  sheet.mergeCells(1, 1, 1, 8);
  const titleCell = sheet.getCell("A1");
  titleCell.value = BRANDING.schoolName;
  titleCell.font = { bold: true, size: 12 };

  sheet.mergeCells(2, 1, 2, 8);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `${BRANDING.campus} | ${BRANDING.department}`;
  subtitleCell.font = { size: 10, color: { argb: "FF6B7280" } };

  sheet.mergeCells(3, 1, 3, 8);
  const systemCell = sheet.getCell("A3");
  systemCell.value = BRANDING.systemName;
  systemCell.font = { bold: true, size: 13, color: { argb: "FF22C55E" } };

  sheet.mergeCells(4, 1, 4, 8);
  const titleRow = sheet.getCell("A4");
  titleRow.value = reportTitle;
  titleRow.font = { bold: true, size: 14 };

  let row = 5;
  for (const m of meta) {
    sheet.mergeCells(row, 1, row, 8);
    sheet.getCell(row, 1).value = m;
    sheet.getCell(row, 1).font = { size: 9, color: { argb: "FF6B7280" } };
    row++;
  }

  sheet.getRow(row).height = 8; // spacer
  return row + 1; // first row for headers
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

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total readings: ${data.length}`,
    ...(data.truncated
      ? ["Showing only the most recent 5,000 records."]
      : []),
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headerRowIndex = addTitleRows(sheet, "Sensor Readings Report", meta);

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
  sheet.getRow(headerRowIndex).values = headers;
  styleHeaderRow(sheet.getRow(headerRowIndex));

  // Set widths
  sheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 20 },
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
    row++;
  }

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

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total plots: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headerRowIndex = addTitleRows(sheet, "Plot Performance Report", meta);

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
    row++;
  }

  if (data.length > 0) {
    sheet.mergeCells(row, 1, row, 15);
    const noteCell = sheet.getCell(row, 1);
    noteCell.value =
      "Lifetime (not time-range-scoped): Open Alerts, Active Assignments, Latest Height, Latest Leaf Count.";
    noteCell.font = { size: 9, color: { argb: "FF6B7280" } };
  }

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

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total entries: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headerRowIndex = addTitleRows(sheet, "Growth Log Report", meta);

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

  const meta = [
    `Time range: ${rangeLabel}`,
    `Plot filter: ${plotName ?? "All plots"}`,
    `Total alerts: ${data.length}`,
    `Open: ${data.filter((a) => !a.resolved).length}`,
    `Resolved: ${data.filter((a) => a.resolved).length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headerRowIndex = addTitleRows(sheet, "Alerts Report", meta);

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

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total events: ${data.length}`,
    ...(data.truncated
      ? ["Showing only the most recent 100 records per event type."]
      : []),
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headerRowIndex = addTitleRows(sheet, "System Activity Report", meta);

  const headers = ["Timestamp", "Event Type", "Description", "Actor"];
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
    row++;
  }

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

  const meta = [
    `Time range: ${rangeLabel}`,
    `Total students: ${data.length}`,
    `Generated: ${formatDateTime(new Date())}`,
  ];

  const headerRowIndex = addTitleRows(sheet, "Student Activity Report", meta);

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

  return Buffer.from(await wb.xlsx.writeBuffer());
}