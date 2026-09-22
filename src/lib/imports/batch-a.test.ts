import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  detectImportFile,
  importFileFailure,
  isImportFileFailure,
} from "./file-format";
import { parseCsvImportBytes } from "./parse-csv";
import { parseImportWorkbookFile } from "./parse-import-file";
import { sheetJsCellToImportCell } from "./parse-sheetjs";
import { inspectOoxmlWorkbookKind } from "./inspect-ooxml";
import { generateFacultyTemplate } from "./template-generator";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants/user-import";
import {
  MAX_HEADER_SCAN_ROWS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_DATA_ROWS,
  MAX_IMPORT_WORKSHEETS,
} from "./masterlist-mapping";

const encoder = new TextEncoder();
const XLSX_WORKBOOK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const XLSM_WORKBOOK_CONTENT_TYPE =
  "application/vnd.ms-excel.sheet.macroEnabled.main+xml";

const FACULTY_ROWS = [
  [
    "firstName",
    "lastName",
    "email",
    "idNumber",
    "department",
    "position",
  ],
  [
    "Ana Ñ",
    "Sample",
    "ana.sample@bpsu.edu.ph",
    "202000-0001",
    "BS Agriculture - Animal Science",
    "Instructor I",
  ],
];

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function workbookBytes(
  bookType: "xlsx" | "xlsm" | "biff8",
  rows: unknown[][] = FACULTY_ROWS
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Data"
  );
  return XLSX.write(workbook, { type: "buffer", bookType }) as Uint8Array;
}

function rewriteOoxmlManifest(
  bytes: Uint8Array,
  transform: (manifest: string) => string,
  extraEntries: ReadonlyArray<readonly [string, string]> = []
): Uint8Array {
  const archive = XLSX.CFB.read(bytes, { type: "buffer" });
  const entry = XLSX.CFB.find(archive, "/[Content_Types].xml");
  assert.ok(entry);
  const content = Buffer.from(transform(Buffer.from(entry.content).toString("utf8")));
  entry.content = content;
  entry.size = content.length;
  for (const [name, value] of extraEntries) {
    XLSX.CFB.utils.cfb_add(archive, name, Buffer.from(value));
  }
  return XLSX.CFB.write(archive, {
    type: "buffer",
    fileType: "zip",
  }) as Uint8Array;
}

function insertBeforeTypesClose(manifest: string, markup: string): string {
  assert.match(manifest, /<\/Types>/u);
  return manifest.replace("</Types>", `${markup}</Types>`);
}

function replaceWorkbookOverride(
  manifest: string,
  replacement: string
): string {
  const pattern =
    /<Override\b[^>]*\bPartName="\/xl\/workbook\.xml"[^>]*\/>/u;
  assert.match(manifest, pattern);
  return manifest.replace(pattern, replacement);
}

function compoundFileBytes(
  entries: ReadonlyArray<readonly [string, string]>
): Uint8Array {
  const compoundFile = XLSX.CFB.utils.cfb_new();
  for (const [name, value] of entries) {
    XLSX.CFB.utils.cfb_add(compoundFile, name, Buffer.from(value));
  }
  return XLSX.CFB.write(compoundFile, { type: "buffer" }) as Uint8Array;
}

function assertFailureCode(
  result: ReturnType<typeof detectImportFile>,
  expected: ReturnType<typeof importFileFailure>["errorCode"]
) {
  assert.ok(isImportFileFailure(result));
  assert.equal(result.errorCode, expected);
}

test("file detection accepts supported uppercase extensions by content", () => {
  const csv = detectImportFile("USERS.CSV", encoder.encode("a,b\n1,2"));
  assert.ok(!isImportFileFailure(csv));
  assert.equal(csv.format, "csv");

  const xls = detectImportFile("USERS.XLS", workbookBytes("biff8"));
  assert.ok(!isImportFileFailure(xls));
  assert.equal(xls.format, "xls");

  const xlsx = detectImportFile("USERS.XLSX", workbookBytes("xlsx"));
  assert.ok(!isImportFileFailure(xlsx));
  assert.equal(xlsx.format, "xlsx");

  const xlsm = detectImportFile("USERS.XLSM", workbookBytes("xlsm"));
  assert.ok(!isImportFileFailure(xlsm));
  assert.equal(xlsm.format, "xlsm");
});

test("zero-byte and unsupported binary files fail with typed errors", () => {
  assertFailureCode(detectImportFile("empty.csv", new Uint8Array()), "EMPTY_FILE");
  assertFailureCode(
    detectImportFile(
      "renamed.xlsx",
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    "UNSUPPORTED_FORMAT"
  );
});

test("obvious extension and content mismatches are rejected", () => {
  assertFailureCode(
    detectImportFile("grades.xlsx", encoder.encode("a,b\n1,2")),
    "CONTENT_TYPE_MISMATCH"
  );
  assertFailureCode(
    detectImportFile("grades.csv", workbookBytes("biff8")),
    "CONTENT_TYPE_MISMATCH"
  );
});

test("raw BIFF workbook streams are recognized as legacy XLS content", () => {
  const biff2 = Uint8Array.from([
    0x09, 0x00, 0x04, 0x00, 0x02, 0x00, 0x10, 0x00,
  ]);
  const detected = detectImportFile("legacy.xls", biff2);
  assert.ok(!isImportFileFailure(detected));
  assert.equal(detected.contentKind, "biff");
});

test("encrypted OOXML-in-OLE streams receive a password-protected state", () => {
  const bytes = compoundFileBytes([
    ["EncryptionInfo", "synthetic encryption metadata"],
    ["EncryptedPackage", "synthetic encrypted package"],
  ]);
  assertFailureCode(
    detectImportFile("protected.xlsx", bytes),
    "PASSWORD_PROTECTED"
  );
});

test("files over 4 MB fail before parser work", () => {
  assertFailureCode(
    detectImportFile(
      "large.csv",
      new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)
    ),
    "FILE_TOO_LARGE"
  );
});

test("CSV parsing preserves comma, BOM, quoted values, Unicode, CRLF, and empty cells", () => {
  const parsed = parseCsvImportBytes(
    encoder.encode(
      '\uFEFFfirstName,lastName,email,phoneNumber\r\n"Ana, María",Peña,ana@bpsu.edu.ph,\r\nSample,User,user@bpsu.edu.ph,'
    )
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.delimiter, ",");
  assert.equal(parsed.values[0][0], "firstName");
  assert.equal(parsed.values[1][0], "Ana, María");
  assert.equal(parsed.values[1][1], "Peña");
  assert.equal(parsed.values[1][3], "");
});

test("CSV parsing accepts semicolon and tab delimiters only when detected", () => {
  const semicolon = parseCsvImportBytes(
    encoder.encode("firstName;lastName\nAna;Sample\nBen;Example")
  );
  assert.ok(!("error" in semicolon));
  assert.equal(semicolon.delimiter, ";");

  const tab = parseCsvImportBytes(
    encoder.encode("firstName\tlastName\r\nAna\tSample\r\nBen\tExample")
  );
  assert.ok(!("error" in tab));
  assert.equal(tab.delimiter, "\t");
});

test("ambiguous CSV delimiter returns safe reviewable copy", () => {
  const parsed = parseCsvImportBytes(encoder.encode("one undelimited line"));
  assert.ok("error" in parsed);
  assert.equal(parsed.errorCode, "PARSE_ERROR");
  assert.match(parsed.error, /commas, semicolons, or tabs/u);
});

test("synthetic institutional CSV structure is preserved without real records", () => {
  const parsed = parseCsvImportBytes(
    encoder.encode(
      [
        "MID-TERM,,,,,",
        "COLLEGE: Example College,,,,,",
        "PROGRAM/YEAR&SECTION: SAMPLE 1A,,,,,",
        "COURSE CODE: TEST100,,,,,",
        "INSTRUCTOR: SAMPLE INSTRUCTOR,,,,,",
        "NO,STUDENTS,ACTIVITY,TOTAL,EQUIV,QUIZ",
        '1,"SAMPLE, ANA PERSON",10,10,1.0,10',
        "29,,,,,",
        "30,,,,,",
      ].join("\n")
    )
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.values[5][1], "STUDENTS");
  assert.equal(parsed.values[6][1], "SAMPLE, ANA PERSON");
  assert.deepEqual(parsed.values[7].slice(0, 2), ["29", ""]);
});

test("ordinary XLSX still uses the existing ExcelJS analysis path", async () => {
  const bytes = workbookBytes("xlsx");
  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "ordinary.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.fileType, "xlsx");
  assert.equal(result.mappingStatus, "READY");
  assert.equal(result.rows?.[0].raw.firstName, "Ana Ñ");
});

test("official H-Auto XLSX template marker still takes the fast path", async () => {
  const buffer = await generateFacultyTemplate();
  const result = await parseImportWorkbookFile(
    toArrayBuffer(buffer),
    "H-Auto-Faculty-Import-Template.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.fileType, "xlsx");
  assert.equal(result.isTemplateWorkbook, true);
  assert.equal(result.selectedSheet, "Data");
});

test("legacy BIFF XLS converts into the common matrix and preserves Unicode", async () => {
  const bytes = workbookBytes("biff8");
  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "faculty.xls",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.fileType, "xls");
  assert.equal(result.analysis?.fileType, "xls");
  assert.equal(result.rows?.[0].raw.firstName, "Ana Ñ");
});

test("XLSM reads worksheet data without exposing a VBA blob", async () => {
  const bytes = workbookBytes("xlsm");
  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "faculty.xlsm",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.fileType, "xlsm");
  assert.equal(result.mappingStatus, "READY");
  assert.equal("vbaraw" in result, false);
});

test("OOXML subtype mismatch is rejected instead of silently rerouted", async () => {
  const xlsxAsXlsm = await parseImportWorkbookFile(
    toArrayBuffer(workbookBytes("xlsx")),
    "faculty.xlsm",
    "FACULTY"
  );
  assert.ok("error" in xlsxAsXlsm);
  assert.equal(xlsxAsXlsm.errorCode, "CONTENT_TYPE_MISMATCH");

  const xlsmAsXlsx = await parseImportWorkbookFile(
    toArrayBuffer(workbookBytes("xlsm")),
    "faculty.xlsx",
    "FACULTY"
  );
  assert.ok("error" in xlsmAsXlsx);
  assert.equal(xlsmAsXlsx.errorCode, "CONTENT_TYPE_MISMATCH");
});

test("corrupt OOXML and OLE containers fail without raw parser errors", async () => {
  const corruptZip = Uint8Array.from([
    0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const ooxml = await parseImportWorkbookFile(
    toArrayBuffer(corruptZip),
    "broken.xlsx",
    "FACULTY"
  );
  assert.ok("error" in ooxml);
  assert.equal(ooxml.errorCode, "CORRUPT_OR_UNREADABLE");

  const corruptOle = new Uint8Array(512);
  corruptOle.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const xls = await parseImportWorkbookFile(
    toArrayBuffer(corruptOle),
    "broken.xls",
    "FACULTY"
  );
  assert.ok("error" in xls);
  assert.equal(xls.errorCode, "CORRUPT_OR_UNREADABLE");
});

test("SheetJS formula cells convert safely and XLSM identity formulas remain blocked", async () => {
  assert.deepEqual(
    sheetJsCellToImportCell({
      t: "s",
      f: 'CONCATENATE("ana.sample","@bpsu.edu.ph")',
      v: "ana.sample@bpsu.edu.ph",
      w: "ana.sample@bpsu.edu.ph",
    }),
    { text: "ana.sample@bpsu.edu.ph", isFormula: true }
  );
  assert.deepEqual(sheetJsCellToImportCell({ t: "n", v: 0, w: "0" }), {
    text: "0",
  });
  assert.deepEqual(sheetJsCellToImportCell({ t: "e", v: 42, w: "#N/A" }), {
    text: "#N/A",
    isError: true,
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(FACULTY_ROWS);
  sheet.C2 = {
    t: "s",
    f: 'CONCATENATE("ana.sample","@bpsu.edu.ph")',
    v: "ana.sample@bpsu.edu.ph",
  };
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  const bytes = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsm",
  }) as Uint8Array;
  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "formula.xlsm",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.analysis?.sourceRows[0].cells[2].isFormula, true);
  assert.match(result.rows?.[0].errors.join(" ") ?? "", /Formula cells/u);
});

test("legacy parser enforces the visible-sheet bound", async () => {
  const workbook = XLSX.utils.book_new();
  for (let index = 0; index <= MAX_IMPORT_WORKSHEETS; index += 1) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(FACULTY_ROWS),
      `Sheet${index + 1}`
    );
  }
  const bytes = XLSX.write(workbook, {
    type: "buffer",
    bookType: "biff8",
  }) as Uint8Array;
  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "many-sheets.xls",
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.equal(result.errorCode, "TOO_MANY_SHEETS");
});

test("legacy parser enforces column and row bounds during bounded parsing", async () => {
  const wideRows = [
    Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, index) => `c${index}`),
  ];
  const wide = await parseImportWorkbookFile(
    toArrayBuffer(workbookBytes("biff8", wideRows)),
    "wide.xls",
    "FACULTY"
  );
  assert.ok("error" in wide);
  assert.equal(wide.errorCode, "TOO_MANY_COLUMNS");

  const tallRows = [
    FACULTY_ROWS[0],
    ...Array.from(
      { length: MAX_HEADER_SCAN_ROWS + MAX_IMPORT_DATA_ROWS },
      (_, index) => [`row-${index}`]
    ),
  ];
  const tall = await parseImportWorkbookFile(
    toArrayBuffer(workbookBytes("biff8", tallRows)),
    "tall.xls",
    "FACULTY"
  );
  assert.ok("error" in tall);
  assert.equal(tall.errorCode, "TOO_MANY_ROWS");
});

test("OOXML subtype uses the exact workbook override with flexible attribute order", () => {
  const xlsx = workbookBytes("xlsx");
  const reordered = rewriteOoxmlManifest(xlsx, (manifest) =>
    replaceWorkbookOverride(
      manifest,
      `<Override\n ContentType='${XLSX_WORKBOOK_CONTENT_TYPE}'\n PartName='/xl/workbook.xml'/>`
    )
  );
  assert.equal(inspectOoxmlWorkbookKind(toArrayBuffer(reordered)), "xlsx");
  assert.equal(
    inspectOoxmlWorkbookKind(toArrayBuffer(workbookBytes("xlsm"))),
    "xlsm"
  );
});

test("OOXML comments cannot spoof XLSX or XLSM workbook subtype", () => {
  const xlsx = rewriteOoxmlManifest(workbookBytes("xlsx"), (manifest) =>
    insertBeforeTypesClose(manifest, `<!-- ${XLSM_WORKBOOK_CONTENT_TYPE} -->`)
  );
  const xlsm = rewriteOoxmlManifest(workbookBytes("xlsm"), (manifest) =>
    insertBeforeTypesClose(manifest, `<!-- ${XLSX_WORKBOOK_CONTENT_TYPE} -->`)
  );
  assert.equal(inspectOoxmlWorkbookKind(toArrayBuffer(xlsx)), "xlsx");
  assert.equal(inspectOoxmlWorkbookKind(toArrayBuffer(xlsm)), "xlsm");
});

test("unrelated OOXML overrides cannot influence workbook subtype", () => {
  const xlsx = rewriteOoxmlManifest(
    workbookBytes("xlsx"),
    (manifest) =>
      insertBeforeTypesClose(
        manifest,
        `<Override PartName="/custom/opposite.xml" ContentType="${XLSM_WORKBOOK_CONTENT_TYPE}"/>`
      ),
    [["custom/opposite.xml", "<custom/>"]]
  );
  const xlsm = rewriteOoxmlManifest(
    workbookBytes("xlsm"),
    (manifest) =>
      insertBeforeTypesClose(
        manifest,
        `<Override PartName="/custom/opposite.xml" ContentType="${XLSX_WORKBOOK_CONTENT_TYPE}"/>`
      ),
    [["custom/opposite.xml", "<custom/>"]]
  );
  assert.equal(inspectOoxmlWorkbookKind(toArrayBuffer(xlsx)), "xlsx");
  assert.equal(inspectOoxmlWorkbookKind(toArrayBuffer(xlsm)), "xlsm");
});

test("OOXML workbook override is required", () => {
  const missing = rewriteOoxmlManifest(workbookBytes("xlsx"), (manifest) =>
    replaceWorkbookOverride(manifest, "")
  );
  const result = inspectOoxmlWorkbookKind(toArrayBuffer(missing));
  assert.ok(typeof result !== "string");
  assert.equal(result.errorCode, "CORRUPT_OR_UNREADABLE");
});

test("duplicate and conflicting OOXML workbook overrides are rejected", () => {
  const duplicate = rewriteOoxmlManifest(workbookBytes("xlsx"), (manifest) =>
    insertBeforeTypesClose(
      manifest,
      `<Override PartName="/xl/workbook.xml" ContentType="${XLSX_WORKBOOK_CONTENT_TYPE}"/>`
    )
  );
  const conflicting = rewriteOoxmlManifest(workbookBytes("xlsx"), (manifest) =>
    insertBeforeTypesClose(
      manifest,
      `<Override PartName="/xl/workbook.xml" ContentType="${XLSM_WORKBOOK_CONTENT_TYPE}"/>`
    )
  );
  for (const bytes of [duplicate, conflicting]) {
    const result = inspectOoxmlWorkbookKind(toArrayBuffer(bytes));
    assert.ok(typeof result !== "string");
    assert.equal(result.errorCode, "CORRUPT_OR_UNREADABLE");
  }
});

test("semicolon CSV ignores commas inside quoted fields", () => {
  const result = parseCsvImportBytes(
    encoder.encode(
      'name;email\n"Sample, User";sample@bpsu.edu.ph'
    )
  );
  assert.ok(!("error" in result));
  assert.equal(result.delimiter, ";");
  assert.deepEqual(result.values[1], ["Sample, User", "sample@bpsu.edu.ph"]);
});

test("comma CSV ignores semicolons inside quoted fields", () => {
  const result = parseCsvImportBytes(
    encoder.encode(
      'name,email\n"Sample; User",sample@bpsu.edu.ph'
    )
  );
  assert.ok(!("error" in result));
  assert.equal(result.delimiter, ",");
  assert.deepEqual(result.values[1], ["Sample; User", "sample@bpsu.edu.ph"]);
});

test("tab CSV ignores commas inside quoted fields", () => {
  const result = parseCsvImportBytes(
    encoder.encode(
      'name\temail\n"Sample, User"\tsample@bpsu.edu.ph'
    )
  );
  assert.ok(!("error" in result));
  assert.equal(result.delimiter, "\t");
  assert.deepEqual(result.values[1], ["Sample, User", "sample@bpsu.edu.ph"]);
});

test("CSV parsing preserves quoted delimiters and escaped double quotes", () => {
  const result = parseCsvImportBytes(
    encoder.encode(
      'name;email\n"Sample ""Ace"", User";sample@bpsu.edu.ph'
    )
  );
  assert.ok(!("error" in result));
  assert.equal(result.delimiter, ";");
  assert.deepEqual(result.values[1], [
    'Sample "Ace", User',
    "sample@bpsu.edu.ph",
  ]);
});

test("structurally tied mixed-delimiter CSV is rejected", () => {
  const result = parseCsvImportBytes(encoder.encode("a,b;c\n1,2;3"));
  assert.ok("error" in result);
  assert.equal(result.errorCode, "PARSE_ERROR");
  assert.match(result.error, /commas, semicolons, or tabs/u);
});

test("UTF-8 BOM semicolon CSV preserves Unicode", () => {
  const result = parseCsvImportBytes(
    encoder.encode(
      '\uFEFFfirstName;lastName\r\n"Ana Ñ";Peña\r\nSample;User'
    )
  );
  assert.ok(!("error" in result));
  assert.equal(result.delimiter, ";");
  assert.deepEqual(result.values[1], ["Ana Ñ", "Peña"]);
});

test("valid XLS worksheet text named EncryptedPackage is not encryption evidence", async () => {
  const rows = [
    [...FACULTY_ROWS[0], "notes"],
    [...FACULTY_ROWS[1], "EncryptedPackage"],
  ];
  const bytes = workbookBytes("biff8", rows);
  const renamed = detectImportFile("literal.xlsx", bytes);
  assert.ok(isImportFileFailure(renamed));
  assert.equal(renamed.errorCode, "CONTENT_TYPE_MISMATCH");

  const parsed = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "literal.xls",
    "FACULTY"
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.mappingStatus, "READY");
});

test("valid XLS worksheet encryption-name strings remain ordinary data", async () => {
  const rows = [
    [...FACULTY_ROWS[0], "noteOne", "noteTwo"],
    [...FACULTY_ROWS[1], "EncryptedPackage", "EncryptionInfo"],
  ];
  const bytes = workbookBytes("biff8", rows);
  const renamed = detectImportFile("literal.xlsm", bytes);
  assert.ok(isImportFileFailure(renamed));
  assert.equal(renamed.errorCode, "CONTENT_TYPE_MISMATCH");

  const parsed = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "literal.xls",
    "FACULTY"
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.mappingStatus, "READY");
});

test("actual OLE encryption streams classify modern OOXML as password-protected", () => {
  const encrypted = compoundFileBytes([
    ["EncryptionInfo", "synthetic encryption metadata"],
    ["EncryptedPackage", "synthetic encrypted package"],
  ]);
  assertFailureCode(
    detectImportFile("protected.xlsx", encrypted),
    "PASSWORD_PROTECTED"
  );

  const oneStreamOnly = compoundFileBytes([
    ["EncryptedPackage", "not sufficient alone"],
  ]);
  assertFailureCode(
    detectImportFile("not-proven.xlsx", oneStreamOnly),
    "CONTENT_TYPE_MISMATCH"
  );
});
