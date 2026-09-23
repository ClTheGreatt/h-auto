import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  inspectOoxmlWorkbook,
  inspectOoxmlWorkbookKind,
} from "./inspect-ooxml";
import { parseImportWorkbookFile } from "./parse-import-file";
import {
  EXCEL_PARSE_ERROR_MESSAGE,
  parseExcelImportFile,
} from "./parse-excel";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants/user-import";
import {
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_DATA_ROWS,
  MAX_IMPORT_WORKSHEETS,
} from "./masterlist-mapping";
import { detectImportFile, isImportFileFailure } from "./file-format";

const XLSX_WORKBOOK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

const FACULTY_ROWS = [
  ["firstName", "lastName", "email", "idNumber", "department", "position"],
  [
    "Ana",
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

function workbookBytes(bookType: "xlsx" | "xlsm" = "xlsx"): Uint8Array {
  return workbookWithRows(FACULTY_ROWS, bookType);
}

function workbookWithRows(
  rows: unknown[][],
  bookType: "xlsx" | "xlsm" = "xlsx",
  options: { bookSST?: boolean } = {}
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Data"
  );
  return XLSX.write(workbook, {
    type: "buffer",
    bookType,
    ...options,
  }) as Uint8Array;
}

function rewriteParts(
  bytes: Uint8Array,
  changes: Readonly<Record<string, string | null>>
): Uint8Array {
  const archive = XLSX.CFB.read(bytes, { type: "buffer" });
  for (const [name, replacement] of Object.entries(changes)) {
    const path = name.startsWith("/") ? name : `/${name}`;
    const entry = XLSX.CFB.find(archive, path);
    if (replacement === null) {
      assert.ok(entry, `Expected ${path} to exist before deletion`);
      XLSX.CFB.utils.cfb_del(archive, path);
      continue;
    }
    if (entry) {
      const content = Buffer.from(replacement);
      entry.content = content;
      entry.size = content.length;
    } else {
      XLSX.CFB.utils.cfb_add(archive, path, Buffer.from(replacement));
    }
  }
  return XLSX.CFB.write(archive, {
    type: "buffer",
    fileType: "zip",
  }) as Uint8Array;
}

function readPart(bytes: Uint8Array, name: string): string {
  const archive = XLSX.CFB.read(bytes, { type: "buffer" });
  const entry = XLSX.CFB.find(archive, name.startsWith("/") ? name : `/${name}`);
  assert.ok(entry, `Expected ${name} to exist`);
  return Buffer.from(entry.content).toString("utf8");
}

function compatibleXlsxBytes(canonical = workbookBytes()): Uint8Array {
  const manifest = readPart(canonical, "[Content_Types].xml")
    .replace(
      /<Default Extension="xml" ContentType="application\/xml"\/>/u,
      `<Default Extension="xml" ContentType="${XLSX_WORKBOOK_CONTENT_TYPE}"/>`
    )
    .replace(
      /<Override PartName="\/xl\/workbook\.xml"[^>]*\/>/u,
      ""
    );
  return rewriteParts(canonical, { "[Content_Types].xml": manifest });
}

function prefixWorkbookElements(bytes: Uint8Array): Uint8Array {
  const workbookXml = readPart(bytes, "xl/workbook.xml")
    .replace(
      'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    )
    .replace(
      /<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/gu,
      "<$1x:$2"
    );
  return rewriteParts(bytes, { "xl/workbook.xml": workbookXml });
}

function prefixedCompatibleXlsxBytes(
  canonical = workbookBytes()
): Uint8Array {
  return prefixWorkbookElements(compatibleXlsxBytes(canonical));
}

function workbookWithSheetCount(count: number): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (let index = 0; index < count; index += 1) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(FACULTY_ROWS),
      `Data ${index + 1}`
    );
  }
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Uint8Array;
}

function assertRejected(bytes: Uint8Array): void {
  const result = inspectOoxmlWorkbookKind(toArrayBuffer(bytes), "xlsx");
  assert.ok(typeof result !== "string");
}

function minimalOtherOoxmlPackage(
  family: "word" | "ppt"
): Uint8Array {
  const archive = XLSX.CFB.utils.cfb_new();
  const part = family === "word" ? "word/document.xml" : "ppt/presentation.xml";
  const relationshipType =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
  XLSX.CFB.utils.cfb_add(
    archive,
    "/[Content_Types].xml",
    Buffer.from(
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`
    )
  );
  XLSX.CFB.utils.cfb_add(
    archive,
    "/_rels/.rels",
    Buffer.from(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationshipType}" Target="/${part}"/></Relationships>`
    )
  );
  XLSX.CFB.utils.cfb_add(archive, `/${part}`, Buffer.from(`<${family}/>`));
  return XLSX.CFB.write(archive, {
    type: "buffer",
    fileType: "zip",
  }) as Uint8Array;
}

test("canonical XLSX keeps using its authoritative workbook override", () => {
  const inspection = inspectOoxmlWorkbook(
    toArrayBuffer(workbookBytes()),
    "xlsx"
  );
  assert.ok("kind" in inspection);
  assert.equal(inspection.classification, "CANONICAL_XLSX");
  assert.equal(
    inspectOoxmlWorkbookKind(toArrayBuffer(workbookBytes()), "xlsx"),
    "xlsx"
  );
});

test("missing override with complete SpreadsheetML structure is compatible XLSX", () => {
  const inspection = inspectOoxmlWorkbook(
    toArrayBuffer(compatibleXlsxBytes()),
    "xlsx"
  );
  assert.ok("kind" in inspection);
  assert.equal(inspection.classification, "COMPATIBLE_XLSX");
  assert.equal(
    inspectOoxmlWorkbookKind(toArrayBuffer(compatibleXlsxBytes()), "xlsx"),
    "xlsx"
  );
});

test("compatible XLSX reaches ExcelJS and smart import analysis", async () => {
  const result = await parseImportWorkbookFile(
    toArrayBuffer(compatibleXlsxBytes()),
    "producer.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.fileType, "xlsx");
  assert.equal(result.selectedSheet, "Data");
  assert.equal(result.mappingStatus, "READY");
  assert.equal(result.rows?.length, 1);
});

test("prefixed compatible XLSX falls back only after ExcelJS fails", async () => {
  const bytes = prefixedCompatibleXlsxBytes();
  const excelResult = await parseExcelImportFile(
    toArrayBuffer(bytes),
    "FACULTY"
  );
  assert.deepEqual(excelResult, {
    error: EXCEL_PARSE_ERROR_MESSAGE,
    errorCode: "CORRUPT_OR_UNREADABLE",
    failureStage: "WORKBOOK_PARSE",
  });

  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "prefixed.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.fileType, "xlsx");
  assert.equal(result.selectedSheet, "Data");
  assert.equal(result.mappingStatus, "READY");
  assert.equal(result.rows?.length, 1);
});

test("canonical prefixed XLSX remains ExcelJS-only", async () => {
  const bytes = prefixWorkbookElements(workbookBytes());
  const inspection = inspectOoxmlWorkbook(toArrayBuffer(bytes), "xlsx");
  assert.ok("kind" in inspection);
  assert.equal(inspection.classification, "CANONICAL_XLSX");

  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "canonical-prefixed.xlsx",
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.equal(result.errorCode, "CORRUPT_OR_UNREADABLE");
});

test("compatible XLSX fallback preserves formula provenance", async () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(FACULTY_ROWS);
  sheet.C2 = {
    t: "s",
    v: "cached.identity@bpsu.edu.ph",
    f: '"formula.identity@bpsu.edu.ph"',
  };
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  const canonical = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Uint8Array;
  const result = await parseImportWorkbookFile(
    toArrayBuffer(prefixedCompatibleXlsxBytes(canonical)),
    "formula.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.analysis?.sourceRows[0]?.cells[2]?.isFormula, true);
  assert.match(result.rows?.[0]?.errors.join("\n") ?? "", /Formula cells/u);
});

test("compatible XLSX fallback preserves Excel error provenance", async () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(FACULTY_ROWS);
  sheet.C2 = { t: "e", v: 0x2a, w: "#N/A" };
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  const canonical = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Uint8Array;
  const result = await parseImportWorkbookFile(
    toArrayBuffer(prefixedCompatibleXlsxBytes(canonical)),
    "error-cell.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.analysis?.sourceRows[0]?.cells[2]?.isError, true);
  assert.match(result.rows?.[0]?.errors.join("\n") ?? "", /Excel error cells/u);
});

test("verified compatible XLSX returns a safe error when both parsers fail", async () => {
  const canonical = workbookWithRows(FACULTY_ROWS, "xlsx", { bookSST: true });
  const prefixed = prefixedCompatibleXlsxBytes(canonical);
  const bytes = rewriteParts(prefixed, {
    "xl/sharedStrings.xml":
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si>',
  });
  const inspection = inspectOoxmlWorkbook(toArrayBuffer(bytes), "xlsx");
  assert.ok("kind" in inspection);
  assert.equal(inspection.classification, "COMPATIBLE_XLSX");

  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "unreadable-compatible.xlsx",
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.equal(result.errorCode, "CORRUPT_OR_UNREADABLE");
  assert.equal(
    result.error,
    "This file appears damaged or is not a readable Excel/CSV document."
  );
});

test("compatible XLSX fallback preserves the visible-sheet limit", async () => {
  const exact = await parseImportWorkbookFile(
    toArrayBuffer(
      prefixedCompatibleXlsxBytes(workbookWithSheetCount(MAX_IMPORT_WORKSHEETS))
    ),
    "ten-sheets.xlsx",
    "FACULTY"
  );
  assert.ok(!("error" in exact));
  assert.equal(exact.sheets.length, MAX_IMPORT_WORKSHEETS);

  const over = await parseImportWorkbookFile(
    toArrayBuffer(
      prefixedCompatibleXlsxBytes(
        workbookWithSheetCount(MAX_IMPORT_WORKSHEETS + 1)
      )
    ),
    "eleven-sheets.xlsx",
    "FACULTY"
  );
  assert.ok("error" in over);
  assert.equal(over.errorCode, "TOO_MANY_SHEETS");
});

test("compatible XLSX fallback preserves the column limit", async () => {
  const rowsForWidth = (width: number): unknown[][] => [
    [
      ...FACULTY_ROWS[0],
      ...Array.from(
        { length: width - FACULTY_ROWS[0].length },
        (_, index) => `Ignored ${index + 1}`
      ),
    ],
    FACULTY_ROWS[1],
  ];
  const parseWidth = (width: number) =>
    parseImportWorkbookFile(
      toArrayBuffer(
        prefixedCompatibleXlsxBytes(workbookWithRows(rowsForWidth(width)))
      ),
      `${width}-columns.xlsx`,
      "FACULTY"
    );

  const exact = await parseWidth(MAX_IMPORT_COLUMNS);
  assert.ok(!("error" in exact));
  const over = await parseWidth(MAX_IMPORT_COLUMNS + 1);
  assert.ok("error" in over);
  assert.equal(over.errorCode, "TOO_MANY_COLUMNS");
});

test("compatible XLSX fallback preserves the data-row limit", async () => {
  const rowsForCount = (count: number): unknown[][] => [
    FACULTY_ROWS[0],
    ...Array.from({ length: count }, (_, index) => [
      `First${index}`,
      `Last${index}`,
      `faculty${index}@bpsu.edu.ph`,
      `EMP-${index}`,
      "BS Agriculture - Animal Science",
      "Instructor I",
    ]),
  ];
  const parseCount = (count: number) =>
    parseImportWorkbookFile(
      toArrayBuffer(
        prefixedCompatibleXlsxBytes(workbookWithRows(rowsForCount(count)))
      ),
      `${count}-rows.xlsx`,
      "FACULTY"
    );

  const exact = await parseCount(MAX_IMPORT_DATA_ROWS);
  assert.ok(!("error" in exact));
  assert.equal(exact.rows?.length, MAX_IMPORT_DATA_ROWS);
  const over = await parseCount(MAX_IMPORT_DATA_ROWS + 1);
  assert.ok("error" in over);
  assert.equal(over.errorCode, "TOO_MANY_ROWS");
});

test("compatible XLSX fallback preserves 255-character field validation", async () => {
  const parseLength = (length: number) => {
    const rows = [FACULTY_ROWS[0], [...FACULTY_ROWS[1]]];
    rows[1][0] = "A".repeat(length);
    return parseImportWorkbookFile(
      toArrayBuffer(
        prefixedCompatibleXlsxBytes(workbookWithRows(rows))
      ),
      `${length}-characters.xlsx`,
      "FACULTY"
    );
  };

  const exact = await parseLength(255);
  assert.ok(!("error" in exact));
  assert.equal(exact.rows?.[0]?.raw.firstName.length, 255);
  assert.doesNotMatch(exact.rows?.[0]?.errors.join("\n") ?? "", /255 characters/u);

  const over = await parseLength(256);
  assert.ok(!("error" in over));
  assert.equal(over.rows?.[0]?.raw.firstName.length, 256);
  assert.match(over.rows?.[0]?.errors.join("\n") ?? "", /255 characters/u);
});

test("the 4 MB boundary is enforced before compatible fallback", () => {
  const exact = detectImportFile(
    "boundary.xlsx",
    new Uint8Array(MAX_IMPORT_FILE_BYTES)
  );
  assert.ok(!isImportFileFailure(exact) || exact.errorCode !== "FILE_TOO_LARGE");

  const over = detectImportFile(
    "over-limit.xlsx",
    new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)
  );
  assert.ok(isImportFileFailure(over));
  assert.equal(over.errorCode, "FILE_TOO_LARGE");
});

test("missing override does not make an unrelated ZIP compatible", () => {
  const archive = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(archive, "/random.txt", Buffer.from("not a workbook"));
  const bytes = XLSX.CFB.write(archive, {
    type: "buffer",
    fileType: "zip",
  }) as Uint8Array;
  assertRejected(bytes);
});

test("missing override does not make DOCX or PPTX packages compatible", () => {
  assertRejected(minimalOtherOoxmlPackage("word"));
  assertRejected(minimalOtherOoxmlPackage("ppt"));
});

test("encrypted OOXML-in-OLE content never reaches XLSX fallback", async () => {
  const compoundFile = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(
    compoundFile,
    "/EncryptionInfo",
    Buffer.from("synthetic encryption metadata")
  );
  XLSX.CFB.utils.cfb_add(
    compoundFile,
    "/EncryptedPackage",
    Buffer.from("synthetic encrypted package")
  );
  const bytes = XLSX.CFB.write(compoundFile, {
    type: "buffer",
  }) as Uint8Array;
  const result = await parseImportWorkbookFile(
    toArrayBuffer(bytes),
    "protected.xlsx",
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.equal(result.errorCode, "PASSWORD_PROTECTED");
});

test("duplicate conflicting package paths cannot become fallback-eligible", () => {
  const bytes = compatibleXlsxBytes();
  const archive = XLSX.CFB.read(bytes, { type: "buffer" });
  XLSX.CFB.utils.cfb_add(
    archive,
    "/XL/WORKBOOK.XML",
    Buffer.from(
      '<document xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>'
    )
  );
  const duplicated = XLSX.CFB.write(archive, {
    type: "buffer",
    fileType: "zip",
  }) as Uint8Array;
  assertRejected(duplicated);
});

test("plain text at xl/workbook.xml cannot satisfy the fallback", () => {
  assertRejected(
    rewriteParts(compatibleXlsxBytes(), {
      "xl/workbook.xml": "this is not XML",
    })
  );
});

test("workbook root must use the exact SpreadsheetML namespace", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "xl/workbook.xml": readPart(bytes, "xl/workbook.xml").replace(
        "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "urn:not-spreadsheetml"
      ),
    })
  );
});

test("workbook root must be a workbook element", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "xl/workbook.xml": readPart(bytes, "xl/workbook.xml")
        .replace("<workbook ", "<document ")
        .replace("</workbook>", "</document>"),
    })
  );
});

test("root officeDocument relationship must target xl/workbook.xml", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "_rels/.rels": readPart(bytes, "_rels/.rels").replace(
        'Target="xl/workbook.xml"',
        'Target="word/document.xml"'
      ),
    })
  );
});

test("external officeDocument relationships cannot satisfy the fallback", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "_rels/.rels": readPart(bytes, "_rels/.rels").replace(
        'Target="xl/workbook.xml"',
        'Target="https://example.invalid/workbook.xml" TargetMode="External"'
      ),
    })
  );
});

test("exactly one officeDocument relationship is required", () => {
  const bytes = compatibleXlsxBytes();
  const rootRelationships = readPart(bytes, "_rels/.rels").replace(
    "</Relationships>",
    '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  );
  assertRejected(
    rewriteParts(bytes, {
      "_rels/.rels": rootRelationships,
    })
  );
});

test("a workbook relationship cannot point to a missing worksheet", () => {
  assertRejected(
    rewriteParts(compatibleXlsxBytes(), {
      "xl/worksheets/sheet1.xml": null,
    })
  );
});

test("an external worksheet relationship cannot satisfy the fallback", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "xl/_rels/workbook.xml.rels": readPart(
        bytes,
        "xl/_rels/workbook.xml.rels"
      ).replace(
        'Target="worksheets/sheet1.xml"',
        'Target="https://example.invalid/sheet1.xml" TargetMode="External"'
      ),
    })
  );
});

test("referenced worksheet must be parseable XML", () => {
  assertRejected(
    rewriteParts(compatibleXlsxBytes(), {
      "xl/worksheets/sheet1.xml": "<worksheet>",
    })
  );
});

test("referenced worksheet root must be SpreadsheetML worksheet", () => {
  assertRejected(
    rewriteParts(compatibleXlsxBytes(), {
      "xl/worksheets/sheet1.xml":
        '<document xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>',
    })
  );
});

test("an explicit conflicting workbook override never falls back", () => {
  const bytes = compatibleXlsxBytes();
  const manifest = readPart(bytes, "[Content_Types].xml").replace(
    "</Types>",
    '<Override PartName="/xl/workbook.xml" ContentType="application/octet-stream"/></Types>'
  );
  assertRejected(rewriteParts(bytes, { "[Content_Types].xml": manifest }));
});

test("a missing override cannot hide authoritative macro evidence", () => {
  assertRejected(
    rewriteParts(compatibleXlsxBytes(), {
      "xl/vbaProject.bin": "synthetic macro-project marker",
    })
  );
});

test("fallback requires a parseable content-types document", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "[Content_Types].xml": readPart(bytes, "[Content_Types].xml").replace(
        "</Types>",
        ""
      ),
    })
  );
});

test("XLSM content renamed XLSX remains a subtype mismatch", async () => {
  const result = await parseImportWorkbookFile(
    toArrayBuffer(workbookBytes("xlsm")),
    "renamed.xlsx",
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.equal(result.errorCode, "CONTENT_TYPE_MISMATCH");
});

test("XLSX MIME text in a comment cannot spoof structural evidence", () => {
  const bytes = compatibleXlsxBytes();
  const manifest = readPart(bytes, "[Content_Types].xml").replace(
    "</Types>",
    `<!-- ${XLSX_WORKBOOK_CONTENT_TYPE} --></Types>`
  );
  assertRejected(
    rewriteParts(bytes, {
      "[Content_Types].xml": manifest,
      "_rels/.rels": "<not-relationships/>",
    })
  );
});

test("worksheet path traversal is rejected", () => {
  const bytes = compatibleXlsxBytes();
  assertRejected(
    rewriteParts(bytes, {
      "xl/_rels/workbook.xml.rels": readPart(
        bytes,
        "xl/_rels/workbook.xml.rels"
      ).replace(
        'Target="worksheets/sheet1.xml"',
        'Target="../worksheets/sheet1.xml"'
      ),
    })
  );
});
