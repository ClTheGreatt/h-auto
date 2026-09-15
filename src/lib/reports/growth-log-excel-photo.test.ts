import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { generateGrowthLogExcel } from "./excel-generators";
import { buildReportExportContext } from "./export-context";

const cloud = "fixture-cloud";
const trusted = `https://res.cloudinary.com/${cloud}/image/upload/v123/h-auto/growth-logs/photo.jpg`;
const context = buildReportExportContext(
  { firstName: "Admin", middleName: null, lastName: "Reviewer", role: "ADMIN", section: null },
  new Date("2026-09-15T10:30:00+08:00")
);

test("Growth Log Excel keeps total count and links only the validated first project photo", async () => {
  const previousCloud = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = cloud;
  try {
    const rows = [
      { imageCount: 2, imageUrls: [trusted, trusted] },
      { imageCount: 0, imageUrls: [] },
      { imageCount: 1, imageUrls: ["https://evil.example/photo.jpg"] },
      { imageCount: 2, imageUrls: ["file:///etc/passwd", trusted] },
      { imageCount: 1, imageUrls: [trusted] },
    ].map((photos, index) => ({
      createdAt: new Date("2026-09-15T10:30:00+08:00"),
      plotName: `Demo ${index}`,
      stageName: "Fruiting",
      authorName: "Test Author",
      plantHeightCm: 10,
      leafCount: 3,
      observations: "Healthy",
      notes: "Local fixture",
      ...photos,
    }));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await generateGrowthLogExcel(rows, "Last 7 days", undefined, context) as never);
    const sheet = workbook.getWorksheet("Growth Log");
    assert.ok(sheet);
    let headerRow = 0;
    for (let row = 1; row <= sheet.rowCount; row++) {
      if (sheet.getCell(row, 1).value === "Date / Time") headerRow = row;
    }
    assert.ok(headerRow);
    assert.equal(sheet.getCell(headerRow, 9).value, "Photo Count");
    assert.equal(sheet.getCell(headerRow, 10).value, "Photo");
    assert.deepEqual(sheet.autoFilter, `A${headerRow}:J${headerRow}`);
    assert.equal(sheet.getCell(headerRow + 1, 9).value, 2);
    assert.deepEqual(sheet.getCell(headerRow + 1, 10).value, {
      text: "View first photo",
      hyperlink: trusted,
    });
    assert.equal(sheet.getCell(headerRow + 1, 10).font?.underline, true);
    assert.equal(sheet.getCell(headerRow + 2, 9).value, 0);
    assert.equal(sheet.getCell(headerRow + 2, 10).value, "—");
    assert.equal(sheet.getCell(headerRow + 3, 10).value, "Unavailable");
    assert.equal(sheet.getCell(headerRow + 4, 10).value, "Unavailable");
    assert.deepEqual(sheet.getCell(headerRow + 5, 10).value, {
      text: "View photo",
      hyperlink: trusted,
    });
    for (const row of [headerRow + 2, headerRow + 3, headerRow + 4]) {
      assert.equal(typeof sheet.getCell(row, 10).value, "string");
    }
  } finally {
    if (previousCloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previousCloud;
  }
});
