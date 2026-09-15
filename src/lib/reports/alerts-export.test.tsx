import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidElement, type ReactNode } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { summarizeAlertNotifications, type AlertReportRow } from "./alert-notifications";
import { loadReportBrandingAssets } from "./branding-assets";
import { generateAlertsExcel } from "./excel-generators";
import { buildReportExportContext } from "./export-context";
import { AlertsPDF } from "./pdf-generators";
import { summarizeAlerts } from "./summaries";

const exportContext = buildReportExportContext(
  { firstName: "Admin", middleName: null, lastName: "Reviewer", role: "ADMIN", section: null },
  new Date("2026-09-15T10:30:00+08:00")
);

function alertRow(notificationCount = 3, sameUser = false): AlertReportRow {
  const notifications = Array.from({ length: notificationCount }, (_, index) => ({
    userId: sameUser ? "user-a" : index === 0 ? "user-a" : index === 1 ? "user-b" : `user-${index}`,
    channel: index === 0 ? "SMS" as const : index === 1 ? "EMAIL" as const : "PUSH" as const,
    status: index === 2 ? "FAILED" as const : "SENT" as const,
    user: { firstName: "Aaron", lastName: "Alfonso" },
  }));
  return {
    createdAt: new Date("2026-09-15T09:00:00+08:00"),
    plotName: "Demo Plot",
    type: "LOW_SOIL_MOISTURE",
    severity: "CRITICAL",
    message: "Soil moisture below threshold",
    resolved: false,
    resolvedAt: null,
    ...summarizeAlertNotifications(notifications),
  };
}

async function workbookFor(data: AlertReportRow[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await generateAlertsExcel(data, "Last 7 days", undefined, exportContext) as never
  );
  return workbook;
}

function findHeaderRow(sheet: ExcelJS.Worksheet, header: string) {
  for (let row = 1; row <= sheet.rowCount; row++) {
    if (sheet.getCell(row, 1).value === header) return row;
  }
  throw new Error(`Missing header: ${header}`);
}

function collectRenderedText(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(collectRenderedText);
  if (isValidElement(node)) {
    const props = node.props as {
      children?: ReactNode;
      columns?: Array<{ label: string }>;
    };
    return [
      ...(props.columns?.map((column) => column.label) ?? []),
      ...collectRenderedText(props.children),
    ];
  }
  if (node === null || node === undefined || typeof node === "boolean") return [];
  return [String(node)];
}

test("Alerts Excel main table stays numeric, aligned, filterable, and one row per Alert", async () => {
  const rows = [alertRow(), { ...alertRow(0), resolved: true, severity: "INFO" }];
  const workbook = await workbookFor(rows);
  assert.equal(workbook.worksheets.length, 2);
  const sheet = workbook.getWorksheet("Alerts");
  assert.ok(sheet);
  const headerRow = findHeaderRow(sheet, "Date / Time");
  const headings = Array.from({ length: 10 }, (_, index) => sheet.getCell(headerRow, index + 1).value);
  assert.deepEqual(headings, [
    "Date / Time", "Plot", "Type", "Severity", "Message", "Status", "Resolved At",
    "Sent Records", "Failed Records", "Recipient Users",
  ]);
  assert.deepEqual(sheet.autoFilter, `A${headerRow}:J${headerRow}`);
  assert.equal(sheet.views[0]?.state, "frozen");
  if (sheet.views[0]?.state !== "frozen") throw new Error("Expected frozen view");
  assert.equal(sheet.views[0].ySplit, headerRow);
  assert.equal(sheet.pageSetup.printTitlesRow, `${headerRow}:${headerRow}`);
  assert.equal(sheet.getCell(headerRow + 1, 2).value, "Demo Plot");
  assert.equal(sheet.getCell(headerRow + 2, 6).value, "Resolved");
  assert.deepEqual([8, 9, 10].map((column) => sheet.getCell(headerRow + 1, column).value), [2, 1, 3]);
  for (const column of [8, 9, 10]) {
    assert.equal(typeof sheet.getCell(headerRow + 1, column).value, "number");
  }
  assert.equal(sheet.getCell(headerRow + 3, 1).value, null);
  assert.doesNotMatch(JSON.stringify(sheet.getRow(headerRow + 1).values), /Aaron Alfonso/);
});

test("Alert Notifications sheet retains every scoped notification row and is filterable", async () => {
  const row = alertRow();
  row.notificationDetails.push({ recipient: "Aaron Alfonso", channel: "SMS", status: "FAILED" });
  row.failedNotificationRecords++;
  const workbook = await workbookFor([row]);
  const detail = workbook.getWorksheet("Alert Notifications");
  assert.ok(detail);
  assert.equal(detail.getCell(1, 1).value, "ALERT NOTIFICATIONS");
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => detail.getCell(2, index + 1).value), [
    "Alert Date", "Plot", "Alert Type", "Severity", "Recipient", "Channel", "Status",
  ]);
  assert.deepEqual(detail.autoFilter, "A2:G2");
  assert.equal(detail.views[0]?.state, "frozen");
  if (detail.views[0]?.state !== "frozen") throw new Error("Expected frozen detail view");
  assert.equal(detail.views[0].ySplit, 2);
  assert.equal(detail.pageSetup.printTitlesRow, "2:2");
  assert.equal(detail.rowCount, 6);
  assert.deepEqual([3, 4, 5, 6].map((index) => detail.getCell(index, 6).value), [
    "SMS", "EMAIL", "PUSH", "SMS",
  ]);
  assert.deepEqual([3, 4, 5, 6].map((index) => detail.getCell(index, 7).value), [
    "SENT", "SENT", "FAILED", "FAILED",
  ]);
  assert.equal(detail.getCell(3, 5).value, "Aaron Alfonso");
  assert.equal(detail.getCell(4, 5).value, "Aaron Alfonso");
  assert.doesNotMatch(JSON.stringify(detail.model), /user-a|user-b/);
});

test("Alerts Excel remains valid when no notifications exist", async () => {
  const workbook = await workbookFor([{ ...alertRow(0), recipientUsers: 0 }]);
  const main = workbook.getWorksheet("Alerts");
  const detail = workbook.getWorksheet("Alert Notifications");
  assert.ok(main && detail);
  const headerRow = findHeaderRow(main, "Date / Time");
  assert.deepEqual([8, 9, 10].map((column) => main.getCell(headerRow + 1, column).value), [0, 0, 0]);
  assert.equal(detail.rowCount, 2);
  assert.deepEqual(detail.autoFilter, "A2:G2");
});

test("one multichannel user is one numeric main-sheet recipient but several detail rows", async () => {
  const workbook = await workbookFor([alertRow(3, true)]);
  const main = workbook.getWorksheet("Alerts");
  const detail = workbook.getWorksheet("Alert Notifications");
  assert.ok(main && detail);
  const headerRow = findHeaderRow(main, "Date / Time");
  assert.deepEqual([8, 9, 10].map((column) => main.getCell(headerRow + 1, column).value), [2, 1, 1]);
  assert.equal(detail.rowCount, 5);
  assert.deepEqual([3, 4, 5].map((row) => detail.getCell(row, 6).value), [
    "SMS", "EMAIL", "PUSH",
  ]);
});

test("large notification detail remains a separate filterable list", async () => {
  const workbook = await workbookFor([alertRow(25)]);
  const main = workbook.getWorksheet("Alerts");
  const detail = workbook.getWorksheet("Alert Notifications");
  assert.ok(main && detail);
  const headerRow = findHeaderRow(main, "Date / Time");
  assert.equal(main.getCell(headerRow + 1, 10).value, 25);
  assert.equal(main.getCell(headerRow + 2, 1).value, null);
  assert.equal(detail.rowCount, 27);
  assert.deepEqual(detail.autoFilter, "A2:G2");
  assert.equal(detail.getCell(27, 5).value, "Aaron Alfonso");
});

test("Alerts PDF keeps a compact table at large recipient counts and preserves its summary", async () => {
  const large = alertRow(25);
  const multichannel = alertRow(3, true);
  const sameNameDifferentUsers = alertRow(2);
  const zero = alertRow(0);
  const data = [large, multichannel, sameNameDifferentUsers, zero];
  const summary = summarizeAlerts(data);
  assert.deepEqual(summary.items.map((item) => item.value), [4, 4, 0, 4, 0, 0, 4]);
  const element = AlertsPDF({
    data, rangeLabel: "Last 7 days", assets: await loadReportBrandingAssets(), exportContext,
  });
  const rendered = collectRenderedText(element);
  assert.ok(rendered.includes("Notifications"));
  assert.ok(rendered.includes("Recipient Users"));
  assert.ok(rendered.includes("24 sent / 1 failed"));
  assert.ok(rendered.includes("2 sent / 1 failed"));
  assert.ok(rendered.includes("2 sent / 0 failed"));
  assert.ok(rendered.includes("0 sent / 0 failed"));
  assert.ok(rendered.includes("25"));
  assert.ok(rendered.includes("1"));
  assert.ok(rendered.includes("2"));
  assert.ok(rendered.includes("0"));
  assert.ok(!rendered.includes("Aaron Alfonso"));
  assert.ok(!rendered.includes("SMS Sent"));
  const pdf = await renderToBuffer(element);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
});
