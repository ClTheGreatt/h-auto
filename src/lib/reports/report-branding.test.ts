import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { BRANDING } from "./branding";
import { loadReportBrandingAssets } from "./branding-assets";
import {
  generateActivityExcel,
  generateSensorReadingsExcel,
} from "./excel-generators";

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
    await generateSensorReadingsExcel(data, "Last 7 days")
  );
  const sheet = workbook.getWorksheet("Sensor Readings");
  assert.ok(sheet);

  const headerRow = findHeaderRow(sheet, "Date / Time");
  assert.equal(sheet.getImages().length, 2);
  assert.ok(sheet.model.merges.includes("B1:J1"));
  assert.ok(sheet.model.merges.includes("A6:K6"));
  assert.deepEqual(sheet.autoFilter, "A12:K12");
  assert.equal(headerRow, 12);
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
    await generateActivityExcel(data, "Last 7 days")
  );
  const sheet = workbook.getWorksheet("System Activity");
  assert.ok(sheet);

  const headerRow = findHeaderRow(sheet, "Timestamp");
  assert.equal(sheet.getImages().length, 2);
  assert.ok(sheet.model.merges.includes("B1:G1"));
  assert.ok(sheet.model.merges.includes("A6:H6"));
  assert.deepEqual(sheet.autoFilter, "A11:D11");
  assert.equal(headerRow, 11);
  const narrowView = sheet.views[0];
  assert.equal(narrowView?.state, "frozen");
  if (!narrowView || narrowView.state !== "frozen") {
    throw new Error("Expected a frozen worksheet view");
  }
  assert.equal(narrowView.ySplit, headerRow);
  assert.equal(sheet.pageSetup.orientation, "portrait");
  assert.equal(sheet.pageSetup.printTitlesRow, `${headerRow}:${headerRow}`);
});
