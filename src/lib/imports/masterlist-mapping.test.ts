import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { generateFacultyTemplate, generateStudentTemplate } from "./template-generator";
import { parseExcelImportFile } from "./parse-excel";
import { buildParsedRows } from "./parse-rows";
import {
  MAX_HEADER_SCAN_ROWS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_DATA_ROWS,
  advanceAnalysisGeneration,
  analyzeImportMatrix,
  applyManualColumnMapping,
  buildAutomaticColumns,
  detectHeaderCandidates,
  findAliasCollisions,
  isCurrentAnalysisGeneration,
  mapSourceRows,
  matrixFromValues,
  normalizeImportHeader,
  selectDetectedHeader,
  type ImportMatrixAnalysis,
  type ImportMatrixRow,
} from "./masterlist-mapping";

const FACULTY_HEADERS = [
  "firstName *",
  "middleName",
  "lastName *",
  "email *",
  "phoneNumber",
  "idNumber *",
  "department *",
  "position *",
];

const STUDENT_HEADERS = [
  "firstName *",
  "middleName",
  "lastName *",
  "email *",
  "phoneNumber",
  "idNumber *",
  "academicYear",
  "course *",
  "yearLevel",
  "section *",
];

const FACULTY_VALUES = [
  "Ana",
  "M",
  "Cruz",
  "ana.cruz@bpsu.edu.ph",
  "+639171234567",
  "202000-0001",
  "BS Agriculture - Animal Science",
  "Instructor I",
];

function analyze(
  values: unknown[][],
  type: "FACULTY" | "STUDENT_FARMER" = "FACULTY",
  forcedHeaderRow?: number
) {
  return analyzeImportMatrix(matrixFromValues(values), type, {
    fileType: "csv",
    sheetName: "CSV",
    ...(forcedHeaderRow !== undefined ? { forcedHeaderRow } : {}),
  });
}

function requireAnalysis(
  result: ReturnType<typeof analyze>
): ImportMatrixAnalysis {
  assert.ok("analysis" in result, "expected matrix analysis to succeed");
  return result.analysis;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

async function workbookBuffer(
  sheets: Array<{
    name: string;
    rows: unknown[][];
    state?: "visible" | "hidden" | "veryHidden";
  }>
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const definition of sheets) {
    const sheet = workbook.addWorksheet(definition.name, {
      state: definition.state ?? "visible",
    });
    for (const row of definition.rows) sheet.addRow(row);
  }
  return toArrayBuffer(Buffer.from(await workbook.xlsx.writeBuffer()));
}

test("exact H-Auto Faculty template headers auto-map", () => {
  const analysis = requireAnalysis(analyze([FACULTY_HEADERS, FACULTY_VALUES]));
  assert.equal(analysis.mappingStatus, "READY");
  assert.equal(analysis.selectedHeaderRow, 1);
  assert.deepEqual(
    analysis.columns.map((column) => column.mappedField),
    [
      "firstName",
      "middleName",
      "lastName",
      "email",
      "phoneNumber",
      "idNumber",
      "department",
      "position",
    ]
  );
});

test("exact H-Auto Student template headers auto-map", () => {
  const analysis = requireAnalysis(
    analyze([STUDENT_HEADERS], "STUDENT_FARMER")
  );
  assert.equal(analysis.mappingStatus, "READY");
  assert.equal(analysis.columns[6].mappedField, "academicYear");
});

test("title rows before a masterlist are supported", () => {
  const analysis = requireAnalysis(
    analyze([
      ["BATAAN PENINSULA STATE UNIVERSITY"],
      ["FACULTY MASTERLIST"],
      ["A.Y. 2026-2027"],
      ["Given Name", "Surname", "Email Address", "Employee ID", "Dept.", "Designation"],
      ["Ana", "Cruz", "ana.cruz@bpsu.edu.ph", "202000-0001", "BS Agriculture - Animal Science", "Instructor I"],
    ])
  );
  assert.equal(analysis.selectedHeaderRow, 4);
});

test("header detection requires the documented threshold", () => {
  const candidates = detectHeaderCandidates(
    matrixFromValues([["First Name", "Email", "Department"]]),
    "FACULTY"
  );
  assert.equal(candidates[0].qualifies, false);
  assert.equal(selectDetectedHeader(candidates), null);
});

test("header candidate previews remain concise", () => {
  const candidates = detectHeaderCandidates(
    matrixFromValues([["A".repeat(200), ...FACULTY_HEADERS]]),
    "FACULTY"
  );
  assert.ok(candidates[0].preview.length <= 120);
  assert.match(candidates[0].preview, /\.\.\.$/);
});

test("tied qualifying header rows remain ambiguous", () => {
  const analysis = requireAnalysis(
    analyze([FACULTY_HEADERS, FACULTY_HEADERS, FACULTY_VALUES])
  );
  assert.equal(analysis.selectedHeaderRow, null);
  assert.equal(analysis.mappingStatus, "AMBIGUOUS");
});

test("a header candidate wins only with a two-field score lead", () => {
  const candidates = detectHeaderCandidates(
    matrixFromValues([
      FACULTY_HEADERS,
      ["First Name", "Last Name", "Email", "Employee ID", "Department", "Position"],
    ]),
    "FACULTY"
  );
  assert.equal(selectDetectedHeader(candidates)?.rowNumber, 1);
});

test("Faculty aliases are recognized exactly after normalization", () => {
  const columns = buildAutomaticColumns(
    ["Given Name", "Family Name", "E-mail", "Employee No.", "Dept.", "Faculty Position"],
    "FACULTY"
  );
  assert.deepEqual(
    columns.map((column) => column.mappedField),
    ["firstName", "lastName", "email", "idNumber", "department", "position"]
  );
});

test("Student aliases are recognized exactly after normalization", () => {
  const columns = buildAutomaticColumns(
    ["Given Name", "Surname", "Email Address", "Student No.", "Program", "Class Section"],
    "STUDENT_FARMER"
  );
  assert.deepEqual(
    columns.map((column) => column.mappedField),
    ["firstName", "lastName", "email", "idNumber", "course", "section"]
  );
});

test("unknown columns default to Ignore", () => {
  const [column] = buildAutomaticColumns(["Guardian Address"], "STUDENT_FARMER");
  assert.equal(column.status, "IGNORED");
  assert.equal(column.mappedField, null);
});

test("Name remains deliberately unmapped", () => {
  const [column] = buildAutomaticColumns(["Name"], "FACULTY");
  assert.equal(column.status, "UNMAPPED");
});

test("Year remains deliberately unmapped", () => {
  const [column] = buildAutomaticColumns(["Year"], "STUDENT_FARMER");
  assert.equal(column.status, "UNMAPPED");
});

test("duplicate normalized headers are rejected for review", () => {
  const columns = buildAutomaticColumns(["Email", "EMAIL"], "FACULTY");
  assert.ok(columns.every((column) => column.status === "AMBIGUOUS"));
  assert.ok(columns.every((column) => column.mappedField === null));
});

test("controlled alias dictionaries have no collisions", () => {
  assert.deepEqual(findAliasCollisions("FACULTY"), []);
  assert.deepEqual(findAliasCollisions("STUDENT_FARMER"), []);
});

test("missing required fields produce NEEDS_MAPPING", () => {
  const analysis = requireAnalysis(
    analyze([["First Name", "Last Name", "Email", "Employee ID"]], "FACULTY", 1)
  );
  assert.equal(analysis.mappingStatus, "NEEDS_MAPPING");
  assert.deepEqual(analysis.missingRequiredFields, ["department", "position"]);
});

test("one source column can hold only one target mapping", () => {
  const columns = buildAutomaticColumns(["Unfamiliar"], "FACULTY");
  const first = applyManualColumnMapping(columns, "FACULTY", 0, "firstName");
  assert.ok("columns" in first);
  const second = applyManualColumnMapping(first.columns, "FACULTY", 0, "lastName");
  assert.ok("columns" in second);
  assert.equal(second.columns[0].mappedField, "lastName");
  assert.equal(second.columns.filter((column) => column.mappedField).length, 1);
});

test("two source columns cannot map to the same target", () => {
  const columns = buildAutomaticColumns(["One", "Two"], "FACULTY");
  const first = applyManualColumnMapping(columns, "FACULTY", 0, "firstName");
  assert.ok("columns" in first);
  const second = applyManualColumnMapping(first.columns, "FACULTY", 1, "firstName");
  assert.ok("error" in second);
});

test("manual override maps an unfamiliar header", () => {
  const columns = buildAutomaticColumns(["Program / Degree"], "STUDENT_FARMER");
  const result = applyManualColumnMapping(
    columns,
    "STUDENT_FARMER",
    0,
    "course"
  );
  assert.ok("columns" in result);
  assert.equal(result.columns[0].mappedField, "course");
  assert.equal(result.columns[0].status, "MANUAL_MAPPED");
});

test("physical source row numbers survive mapping", () => {
  const analysis = requireAnalysis(
    analyze([
      ["Title"],
      ["Subtitle"],
      ["Year"],
      FACULTY_HEADERS,
      FACULTY_VALUES,
    ])
  );
  assert.equal(mapSourceRows(analysis)[0].rowNumber, 5);
});

test("role-specific ID aliases differ between Faculty and Student", () => {
  assert.equal(
    buildAutomaticColumns(["Employee ID"], "FACULTY")[0].mappedField,
    "idNumber"
  );
  assert.equal(
    buildAutomaticColumns(["Employee ID"], "STUDENT_FARMER")[0].mappedField,
    null
  );
  assert.equal(
    buildAutomaticColumns(["Student Number"], "STUDENT_FARMER")[0].mappedField,
    "idNumber"
  );
});

test("extra columns never enter mapped row objects", () => {
  const analysis = requireAnalysis(
    analyze([
      [...FACULTY_HEADERS, "Sex", "Remarks"],
      [...FACULTY_VALUES, "F", "Dean's list"],
    ])
  );
  const [mapped] = mapSourceRows(analysis);
  assert.equal("Sex" in mapped.raw, false);
  assert.equal("Remarks" in mapped.raw, false);
  assert.deepEqual(Object.keys(mapped.raw), [
    "firstName",
    "middleName",
    "lastName",
    "email",
    "phoneNumber",
    "idNumber",
    "department",
    "position",
  ]);
});

test("formula in a mapped field becomes a row parsing error", () => {
  const matrix: ImportMatrixRow[] = [
    { rowNumber: 1, cells: FACULTY_HEADERS.map((text) => ({ text })) },
    {
      rowNumber: 2,
      cells: FACULTY_VALUES.map((text, index) => ({
        text,
        ...(index === 0 ? { isFormula: true } : {}),
      })),
    },
  ];
  const result = analyzeImportMatrix(matrix, "FACULTY", {
    fileType: "xlsx",
    sheetName: "Faculty",
  });
  assert.ok("analysis" in result);
  assert.deepEqual(mapSourceRows(result.analysis)[0].parsingErrors, [
    "Formula cells are not supported for imported user fields.",
  ]);
});

test("formula in an ignored field is harmless", () => {
  const matrix: ImportMatrixRow[] = [
    {
      rowNumber: 1,
      cells: [...FACULTY_HEADERS, "Remarks"].map((text) => ({ text })),
    },
    {
      rowNumber: 2,
      cells: [
        ...FACULTY_VALUES.map((text) => ({ text })),
        { text: "cached", isFormula: true },
      ],
    },
  ];
  const result = analyzeImportMatrix(matrix, "FACULTY", {
    fileType: "xlsx",
    sheetName: "Faculty",
  });
  assert.ok("analysis" in result);
  assert.deepEqual(mapSourceRows(result.analysis)[0].parsingErrors, []);
});

test("ExcelJS shared formulas are rejected in mapped fields", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Faculty");
  sheet.addRow(FACULTY_HEADERS);
  sheet.addRow(FACULTY_VALUES);
  sheet.addRow([
    "Bea",
    "Q",
    "Santos",
    "bea.santos@bpsu.edu.ph",
    "+639181234567",
    "202000-0002",
    "BS Agriculture - Crop Science",
    "Instructor II",
  ]);
  sheet.getCell("A2").value = {
    formula: '"Ana"',
    result: "Ana",
    shareType: "shared",
    ref: "A2:A3",
  } as ExcelJS.CellValue;
  sheet.getCell("A3").value = {
    sharedFormula: "A2",
    result: "Bea",
  };

  const result = await parseExcelImportFile(
    toArrayBuffer(Buffer.from(await workbook.xlsx.writeBuffer())),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.ok(result.analysis);
  assert.deepEqual(
    mapSourceRows(result.analysis).map((row) => row.parsingErrors),
    [
      ["Formula cells are not supported for imported user fields."],
      ["Formula cells are not supported for imported user fields."],
    ]
  );
});

test("mapped Excel #N/A error cells become row parsing errors", async () => {
  const values: unknown[] = [...FACULTY_VALUES];
  values[0] = { error: "#N/A" };
  const result = await parseExcelImportFile(
    await workbookBuffer([{ name: "Faculty", rows: [FACULTY_HEADERS, values] }]),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.ok(result.analysis);
  assert.deepEqual(mapSourceRows(result.analysis)[0].parsingErrors, [
    "Excel error cells are not supported for imported user fields.",
  ]);
  assert.ok(
    result.rows?.[0].errors.includes(
      "Excel error cells are not supported for imported user fields."
    )
  );
});

test("mapped Excel #VALUE! error cells become row parsing errors", async () => {
  const values: unknown[] = [...FACULTY_VALUES];
  values[2] = { error: "#VALUE!" };
  const result = await parseExcelImportFile(
    await workbookBuffer([{ name: "Faculty", rows: [FACULTY_HEADERS, values] }]),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.ok(result.analysis);
  assert.deepEqual(mapSourceRows(result.analysis)[0].parsingErrors, [
    "Excel error cells are not supported for imported user fields.",
  ]);
});

test("Excel error cells in ignored columns are harmless", async () => {
  const result = await parseExcelImportFile(
    await workbookBuffer([
      {
        name: "Faculty",
        rows: [
          [...FACULTY_HEADERS, "Remarks"],
          [...FACULTY_VALUES, { error: "#REF!" }],
        ],
      },
    ]),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.ok(result.analysis);
  assert.deepEqual(mapSourceRows(result.analysis)[0].parsingErrors, []);
});

test("Excel error cells in optional mapped fields are rejected", async () => {
  const values: unknown[] = [...FACULTY_VALUES];
  values[1] = { error: "#DIV/0!" };
  const result = await parseExcelImportFile(
    await workbookBuffer([{ name: "Faculty", rows: [FACULTY_HEADERS, values] }]),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.ok(result.analysis);
  assert.deepEqual(mapSourceRows(result.analysis)[0].parsingErrors, [
    "Excel error cells are not supported for imported user fields.",
  ]);
  assert.deepEqual(result.rows?.[0].errors, [
    "Excel error cells are not supported for imported user fields.",
  ]);
});

test("literal text #N/A is not confused with an Excel error cell", async () => {
  const values = [...FACULTY_VALUES];
  values[1] = "#N/A";
  const result = await parseExcelImportFile(
    await workbookBuffer([{ name: "Faculty", rows: [FACULTY_HEADERS, values] }]),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.ok(result.analysis);
  const [mapped] = mapSourceRows(result.analysis);
  assert.deepEqual(mapped.parsingErrors, []);
  assert.equal(mapped.raw.middleName, "#N/A");
});

test("header scan is bounded to the first 20 rows", () => {
  const values = Array.from({ length: MAX_HEADER_SCAN_ROWS }, (_, index) => [
    `Title ${index + 1}`,
  ]);
  values.push(FACULTY_HEADERS);
  const analysis = requireAnalysis(analyze(values));
  assert.equal(analysis.selectedHeaderRow, null);
});

test("files wider than 100 columns are rejected", () => {
  const result = analyze([
    Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, index) => `Column ${index}`),
  ]);
  assert.ok("error" in result);
  assert.match(result.error, /more than 100 columns/);
});

test("files with more than 250 data rows are rejected", () => {
  const values: unknown[][] = [FACULTY_HEADERS];
  for (let index = 0; index < MAX_IMPORT_DATA_ROWS + 1; index += 1) {
    values.push([...FACULTY_VALUES]);
  }
  const result = analyze(values);
  assert.ok("error" in result);
  assert.match(result.error, /more than 250 data rows/);
});

test("multiple worksheets with one clear candidate auto-select that sheet", async () => {
  const buffer = await workbookBuffer([
    { name: "Cover", rows: [["Faculty records"]] },
    { name: "Masterlist", rows: [FACULTY_HEADERS, FACULTY_VALUES] },
  ]);
  const result = await parseExcelImportFile(buffer, "FACULTY");
  assert.ok(!("error" in result));
  assert.equal(result.selectedSheet, "Masterlist");
  assert.equal(result.mappingStatus, "READY");
});

test("role-aware alias evidence does not falsely reject a manual Faculty mapping", async () => {
  const buffer = await workbookBuffer([
    {
      name: "Faculty",
      rows: [["Given Name", "Surname", "Email", "Employee ID", "Program"]],
    },
  ]);
  const result = await parseExcelImportFile(buffer, "FACULTY");
  assert.ok(!("error" in result));
  assert.equal(result.selectedSheet, "Faculty");
  assert.equal(result.mappingStatus, "AMBIGUOUS");
});

test("multiple qualifying worksheets require manual selection", async () => {
  const buffer = await workbookBuffer([
    { name: "Section A", rows: [FACULTY_HEADERS, FACULTY_VALUES] },
    { name: "Section B", rows: [FACULTY_HEADERS, FACULTY_VALUES] },
  ]);
  const result = await parseExcelImportFile(buffer, "FACULTY");
  assert.ok(!("error" in result));
  assert.equal(result.selectedSheet, null);
  assert.equal(result.mappingStatus, "AMBIGUOUS");
});

test("one worksheet with ambiguous headers stays selected for header review", async () => {
  const buffer = await workbookBuffer([
    {
      name: "Faculty",
      rows: [FACULTY_HEADERS, FACULTY_HEADERS, FACULTY_VALUES],
    },
  ]);
  const result = await parseExcelImportFile(buffer, "FACULTY");
  assert.ok(!("error" in result));
  assert.equal(result.selectedSheet, "Faculty");
  assert.equal(result.analysis?.selectedHeaderRow, null);
});

test("H-Auto Faculty marker chooses Data fast path", async () => {
  const result = await parseExcelImportFile(
    toArrayBuffer(await generateFacultyTemplate()),
    "FACULTY"
  );
  assert.ok(!("error" in result));
  assert.equal(result.isTemplateWorkbook, true);
  assert.equal(result.selectedSheet, "Data");
  assert.deepEqual(result.sheets.map((sheet) => sheet.name), ["Data"]);
  assert.equal(result.analysis?.selectedHeaderRow, 1);
  assert.equal(result.mappingStatus, "READY");
});

test("H-Auto Student marker chooses Data fast path", async () => {
  const result = await parseExcelImportFile(
    toArrayBuffer(await generateStudentTemplate()),
    "STUDENT_FARMER"
  );
  assert.ok(!("error" in result));
  assert.equal(result.isTemplateWorkbook, true);
  assert.equal(result.selectedSheet, "Data");
  assert.deepEqual(result.sheets.map((sheet) => sheet.name), ["Data"]);
  assert.equal(result.mappingStatus, "READY");
});

test("H-Auto template marker rejects the wrong selected role", async () => {
  const result = await parseExcelImportFile(
    toArrayBuffer(await generateStudentTemplate()),
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.match(result.error, /Student Farmer template/);
});

test("CSV and XLSX matrices converge to the same target shape", async () => {
  const aliases = [
    "Given Name",
    "Middle Initial",
    "Surname",
    "Email Address",
    "Mobile No.",
    "Employee No.",
    "Dept.",
    "Designation",
  ];
  const csvAnalysis = requireAnalysis(analyze([aliases, FACULTY_VALUES]));
  const buffer = await workbookBuffer([
    { name: "Faculty", rows: [aliases, FACULTY_VALUES] },
  ]);
  const xlsx = await parseExcelImportFile(buffer, "FACULTY");
  assert.ok(!("error" in xlsx));
  assert.ok(xlsx.analysis);
  assert.deepEqual(
    mapSourceRows(csvAnalysis)[0].raw,
    mapSourceRows(xlsx.analysis)[0].raw
  );
});

test("a newer analysis generation makes an older result stale", () => {
  const tracker = { current: 0 };
  const generationA = advanceAnalysisGeneration(tracker);
  const generationB = advanceAnalysisGeneration(tracker);

  assert.equal(isCurrentAnalysisGeneration(tracker, generationA), false);
  assert.equal(isCurrentAnalysisGeneration(tracker, generationB), true);
});

test("import-type and file changes invalidate an in-flight analysis", () => {
  const tracker = { current: 0 };
  const facultyFileA = advanceAnalysisGeneration(tracker);

  advanceAnalysisGeneration(tracker); // Faculty -> Student
  assert.equal(isCurrentAnalysisGeneration(tracker, facultyFileA), false);

  const studentFileA = advanceAnalysisGeneration(tracker);
  advanceAnalysisGeneration(tracker); // File A -> File B
  assert.equal(isCurrentAnalysisGeneration(tracker, studentFileA), false);
});

test("sheet and header changes invalidate the previous analysis", () => {
  const tracker = { current: 0 };
  const sheetA = advanceAnalysisGeneration(tracker);
  const sheetB = advanceAnalysisGeneration(tracker);
  assert.equal(isCurrentAnalysisGeneration(tracker, sheetA), false);
  assert.equal(isCurrentAnalysisGeneration(tracker, sheetB), true);

  const headerRow4 = sheetB;
  const headerRow6 = advanceAnalysisGeneration(tracker);
  assert.equal(isCurrentAnalysisGeneration(tracker, headerRow4), false);
  assert.equal(isCurrentAnalysisGeneration(tracker, headerRow6), true);
});

test("changing the selected header rebuilds mapping and row boundaries", () => {
  const values = [
    ["Faculty masterlist"],
    ["Unfamiliar", "Surname"],
    ["Old data", "Old surname"],
    ["Correct table follows"],
    FACULTY_HEADERS,
    FACULTY_VALUES,
  ];
  const rowTwoAnalysis = requireAnalysis(analyze(values, "FACULTY", 2));
  const manual = applyManualColumnMapping(
    rowTwoAnalysis.columns,
    "FACULTY",
    0,
    "firstName"
  );
  assert.ok("columns" in manual);
  assert.equal(manual.columns[0].status, "MANUAL_MAPPED");

  const rowFiveAnalysis = requireAnalysis(analyze(values, "FACULTY", 5));
  assert.equal(rowFiveAnalysis.selectedHeaderRow, 5);
  assert.equal(rowFiveAnalysis.columns[0].status, "AUTO_MAPPED");
  assert.equal(rowFiveAnalysis.columns[0].mappedField, "firstName");
  assert.equal(mapSourceRows(rowFiveAnalysis)[0].rowNumber, 6);
});

test("mapped rows still pass through existing Faculty validation", () => {
  const analysis = requireAnalysis(analyze([FACULTY_HEADERS, FACULTY_VALUES]));
  const mapped = mapSourceRows(analysis);
  const parsed = buildParsedRows(
    mapped.map((row) => row.raw),
    "FACULTY",
    { rowNumbers: mapped.map((row) => row.rowNumber) }
  );
  assert.deepEqual(parsed[0].errors, []);
  assert.equal(parsed[0].rowNumber, 2);
});

test("mapped rows still pass through existing Student validation", () => {
  const values = [
    "Ana",
    "M",
    "Cruz",
    "ana.cruz@bpsu.edu.ph",
    "+639171234567",
    "23-00001",
    "2023-2024",
    "BS Agriculture - Animal Science",
    "4th Year",
    "BSA-4A",
  ];
  const analysis = requireAnalysis(
    analyze([STUDENT_HEADERS, values], "STUDENT_FARMER")
  );
  const mapped = mapSourceRows(analysis);
  const parsed = buildParsedRows(
    mapped.map((row) => row.raw),
    "STUDENT_FARMER",
    { rowNumbers: mapped.map((row) => row.rowNumber) }
  );
  assert.deepEqual(parsed[0].errors, []);
});

test("header normalization applies NFKC, separators, case, and required marker", () => {
  assert.equal(normalizeImportHeader("  FIRST_Name-*  "), "first name");
  assert.equal(normalizeImportHeader("Ｅｍａｉｌ　Ａｄｄｒｅｓｓ"), "email address");
});

test("more than ten visible worksheets are rejected", async () => {
  const definitions = Array.from({ length: 11 }, (_, index) => ({
    name: `Sheet ${index + 1}`,
    rows: [[`Title ${index + 1}`]],
  }));
  const result = await parseExcelImportFile(
    await workbookBuffer(definitions),
    "FACULTY"
  );
  assert.ok("error" in result);
  assert.match(result.error, /more than 10 visible worksheets/);
});

test("hidden worksheets are excluded from normal selection", async () => {
  const buffer = await workbookBuffer([
    { name: "Visible Cover", rows: [["Cover"]] },
    {
      name: "Hidden Masterlist",
      rows: [FACULTY_HEADERS, FACULTY_VALUES],
      state: "hidden",
    },
  ]);
  const result = await parseExcelImportFile(buffer, "FACULTY");
  assert.ok(!("error" in result));
  assert.deepEqual(result.sheets.map((sheet) => sheet.name), ["Visible Cover"]);
  assert.equal(result.selectedSheet, "Visible Cover");
});
