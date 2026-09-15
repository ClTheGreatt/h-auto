import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { BRANDING } from "./branding";
import { loadReportBrandingAssets } from "./branding-assets";
import {
  generateActivityExcel,
  generatePlotPerformanceExcel,
  generateSensorReadingsExcel,
} from "./excel-generators";
import { buildReportExportContext } from "./export-context";

const exportContext = buildReportExportContext(
  {
    firstName: "Admin",
    middleName: null,
    lastName: "Reviewer",
    role: "ADMIN",
    section: null,
  },
  new Date("2026-09-15T10:30:00+08:00")
);

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  return workbook;
}

function findHeaderRow(sheet: ExcelJS.Worksheet, firstHeader: string) {
  for (let row = 1; row <= sheet.rowCount; row++) {
    if (sheet.getCell(row, 1).value === firstHeader) return row;
  }
  throw new Error(`Could not find table header: ${firstHeader}`);
}

test("report branding uses the approved institutional wording", () => {
  assert.equal(BRANDING.universityName, "Bataan Peninsula State University");
  assert.equal(BRANDING.campusName, "Saint Joseph Campus");
  assert.equal(BRANDING.collegeName, "College of Computer Studies");
  assert.equal(BRANDING.systemName, "H-Auto Smart Gardening");
  assert.equal(
    BRANDING.systemSubtitle,
    "Online Smart Gardening Monitoring System for Vegetables using Microcontrollers"
  );

  const serialized = JSON.stringify(BRANDING);
  assert.doesNotMatch(serialized, /Main Campus/i);
  assert.doesNotMatch(serialized, /Client Site/i);
});

test("the shared asset loader returns both original PNG files", async () => {
  const first = await loadReportBrandingAssets();
  const second = await loadReportBrandingAssets();

  assert.strictEqual(first, second);
  assert.ok(first.bpsuSeal.length > pngSignature.length);
  assert.ok(first.agricultureEmblem.length > pngSignature.length);
  assert.deepEqual(first.bpsuSeal.subarray(0, 8), pngSignature);
  assert.deepEqual(first.agricultureEmblem.subarray(0, 8), pngSignature);
});

test("wide Excel reports span their real width and configure the data table", async () => {
  const data = Object.assign([], { truncated: false });
  const workbook = await loadWorkbook(
    await generateSensorReadingsExcel(data, "Last 7 days", undefined, exportContext)
  );
  const sheet = workbook.getWorksheet("Sensor Readings");
  assert.ok(sheet);

  const headerRow = findHeaderRow(sheet, "Date / Time");
  assert.equal(sheet.getImages().length, 2);
  assert.ok(sheet.model.merges.includes("B1:J1"));
  assert.ok(sheet.model.merges.includes("A6:K6"));
  assert.deepEqual(sheet.autoFilter, "A24:K24");
  assert.equal(headerRow, 24);
  assert.equal(sheet.getCell(12, 1).value, "REPORT SUMMARY");
  assert.equal(sheet.getCell(headerRow + 1, 1).value, null);
  const wideView = sheet.views[0];
  assert.equal(wideView?.state, "frozen");
  if (!wideView || wideView.state !== "frozen") {
    throw new Error("Expected a frozen worksheet view");
  }
  assert.equal(wideView.ySplit, headerRow);
  assert.equal(sheet.pageSetup.orientation, "landscape");
  assert.equal(sheet.pageSetup.fitToWidth, 1);
  assert.equal(sheet.pageSetup.fitToHeight, 0);
  assert.equal(sheet.pageSetup.printTitlesRow, `${headerRow}:${headerRow}`);
});

test("narrow Excel reports retain an eight-column branding region", async () => {
  const data = Object.assign([], { truncated: false });
  const workbook = await loadWorkbook(
    await generateActivityExcel(data, "Last 7 days", exportContext)
  );
  const sheet = workbook.getWorksheet("System Activity");
  assert.ok(sheet);

  const headerRow = findHeaderRow(sheet, "Timestamp");
  assert.equal(sheet.getImages().length, 2);
  assert.ok(sheet.model.merges.includes("B1:G1"));
  assert.ok(sheet.model.merges.includes("A6:H6"));
  assert.deepEqual(sheet.autoFilter, "A15:D15");
  assert.equal(headerRow, 15);
  assert.equal(sheet.getCell(11, 1).value, "REPORT SUMMARY");
  assert.equal(sheet.getCell(headerRow + 1, 1).value, null);
  const narrowView = sheet.views[0];
  assert.equal(narrowView?.state, "frozen");
  if (!narrowView || narrowView.state !== "frozen") {
    throw new Error("Expected a frozen worksheet view");
  }
  assert.equal(narrowView.ySplit, headerRow);
  assert.equal(sheet.pageSetup.orientation, "portrait");
  assert.equal(sheet.pageSetup.printTitlesRow, `${headerRow}:${headerRow}`);
});

test("sensor summary measurements remain numeric in Excel", async () => {
  const data = Object.assign(
    [
      {
        recordedAt: new Date("2026-09-15T10:30:00+08:00"),
        plotName: "Demo Plot",
        plotLocation: "Campus",
        deviceCode: "HA-01",
        soilMoisture: 30,
        temperature: null,
        humidity: null,
        lightIntensity: 1e308,
        nitrogen: null,
        phosphorus: null,
        potassium: null,
      },
    ],
    { truncated: false }
  );
  const workbook = await loadWorkbook(
    await generateSensorReadingsExcel(data, "Last 7 days", undefined, exportContext)
  );
  const sheet = workbook.getWorksheet("Sensor Readings");
  assert.ok(sheet);
  const summaryRow = findHeaderRow(sheet, "Soil Moisture (%)");
  assert.equal(sheet.getCell(summaryRow, 2).value, 1);
  assert.equal(sheet.getCell(summaryRow, 3).value, 30);
  assert.equal(sheet.getCell(summaryRow, 4).value, 30);
  assert.equal(sheet.getCell(summaryRow, 5).value, 30);
  const lightRow = findHeaderRow(sheet, "Light (lux)");
  assert.equal(sheet.getCell(lightRow, 2).value, 1);
  for (const column of [3, 4, 5]) {
    const value: unknown = sheet.getCell(lightRow, column).value;
    assert.equal(typeof value, "number");
    if (typeof value !== "number") throw new Error("Expected numeric statistic");
    assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(value / 1e308 - 1) < 1e-12);
  }
});

test("System Activity workbook labels returned event types as included", async () => {
  const data = Object.assign(
    [
      {
        timestamp: new Date("2026-09-15T10:30:00+08:00"),
        eventType: "Import",
        description: "Imported records",
        actor: "Admin Reviewer",
      },
    ],
    { truncated: false }
  );
  const workbook = await loadWorkbook(
    await generateActivityExcel(data, "Last 7 days", exportContext)
  );
  const sheet = workbook.getWorksheet("System Activity");
  assert.ok(sheet);
  assert.equal(findHeaderRow(sheet, "Included event type"), 14);
  const headerRow = findHeaderRow(sheet, "Timestamp");
  assert.equal(headerRow, 17);
  assert.deepEqual(sheet.autoFilter, "A17:D17");
  assert.equal(sheet.getCell(headerRow + 1, 2).value, "Import");
});

test("Plot Performance summary retains data rows and the final table configuration", async () => {
  const data = [
    {
      plotName: "Demo Plot",
      location: "Campus",
      crop: "Tomato",
      variety: "Roma",
      stage: "Vegetative",
      status: "GROWING",
      plantingDate: null,
      expectedHarvest: null,
      readingCount: 5,
      logCount: 2,
      alertCount: 0,
      openAlertCount: 3,
      activeAssignments: 1,
      latestHeight: null,
      latestLeafCount: null,
    },
  ];
  const workbook = await loadWorkbook(
    await generatePlotPerformanceExcel(data, "Last 7 days", exportContext)
  );
  const sheet = workbook.getWorksheet("Plot Performance");
  assert.ok(sheet);
  const headerRow = findHeaderRow(sheet, "Plot");
  assert.equal(headerRow, 21);
  assert.equal(sheet.getImages().length, 2);
  assert.deepEqual(sheet.autoFilter, "A21:O21");
  assert.equal(sheet.views[0]?.state, "frozen");
  if (sheet.views[0]?.state !== "frozen") throw new Error("Expected frozen pane");
  assert.equal(sheet.views[0].ySplit, headerRow);
  assert.equal(sheet.pageSetup.printTitlesRow, "21:21");
  const summaryRow = findHeaderRow(sheet, "Plots represented");
  assert.equal(sheet.getCell(summaryRow, 4).value, 1);
  assert.equal(sheet.getCell(summaryRow, 4).alignment?.horizontal, "left");
  assert.equal(sheet.getCell(headerRow + 1, 1).value, "Demo Plot");
  assert.equal(sheet.getCell(headerRow + 1, 11).value, 0);
  assert.equal(sheet.getCell(headerRow + 1, 12).value, 3);
});
