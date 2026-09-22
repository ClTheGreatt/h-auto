import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeImportMatrix,
  advanceAnalysisGeneration,
  buildAutomaticColumns,
  isCurrentAnalysisGeneration,
  mapSourceRows,
  matrixFromValues,
  selectDetectedHeader,
  updateAnalysisFieldSource,
  updateAnalysisMapping,
  updateReviewedFullNameSource,
  type ImportMatrixAnalysis,
} from "./masterlist-mapping";
import { extractDocumentMetadata, uniqueSafeMetadataByField } from "./metadata-extractor";
import { classifyImportRow, parseReviewedFullName } from "./row-classifier";
import { analyzeImportRows, applyExistingUserConflicts } from "./preflight";

const STUDENT_HEADERS = [
  "First Name", "Middle Name", "Last Name", "Email", "Phone Number",
  "Student Number", "Academic Year", "Program", "Year Level", "Section",
];
const STUDENT_ROW = [
  "Lina", "M", "Santos", "lina.santos@bpsu.edu.ph", "+639171234567",
  "23-00123", "2023-2024", "BS Agriculture - Animal Science", "4th Year", "BSA-4A",
];
const FACULTY_HEADERS = [
  "Given Name", "Middle Name", "Surname", "Email Address", "Mobile Number",
  "Employee ID", "Department", "Designation",
];
const FACULTY_ROW = [
  "Ana", "M", "Cruz", "ana.cruz@bpsu.edu.ph", "+639181234567",
  "202000-0001", "BS Agriculture - Animal Science", "Instructor I",
];

function analysis(
  values: unknown[][],
  type: "FACULTY" | "STUDENT_FARMER" = "STUDENT_FARMER",
  options: { forcedHeaderRow?: number; isOfficialTemplate?: boolean } = {}
): ImportMatrixAnalysis {
  const result = analyzeImportMatrix(matrixFromValues(values), type, {
    fileType: "csv",
    sheetName: "Synthetic",
    ...options,
  });
  assert.ok("analysis" in result);
  return result.analysis;
}

function gradeRecord(): unknown[][] {
  return [
    ...Array.from({ length: 8 }, () => []),
    ["MID-TERM"],
    [],
    ["COLLEGE: College of Technology", "PROGRAM/YEAR&SECTION: BSIT 1A"],
    ["COURSE CODE: TEFC0523", "COURSE TITLE: Comprehensive Mathematics"],
    ["INSTRUCTOR: SAMPLE INSTRUCTOR"],
    [],
    ["NO", "STUDENTS", "ACTIVITY", "TOTAL", "EQUIV", "QUIZ", "TOTAL", "EQUIV"],
    ["1", "SAMPLE, STUDENT ONE", "10", "10", "1.0", "9", "9", "1.2"],
    ["2", "EXAMPLE, STUDENT TWO", "9", "10", "1.2", "8", "9", "1.5"],
    ["29"],
    ["30"],
    ["31"],
  ];
}

test("A official H-Auto Student matrix is READY", () => {
  const result = analysis([STUDENT_HEADERS, STUDENT_ROW], "STUDENT_FARMER", { isOfficialTemplate: true });
  assert.equal(result.document.documentType, "OFFICIAL_HAUTO_TEMPLATE");
  assert.equal(result.document.status, "READY");
});

test("B official H-Auto Faculty matrix is READY", () => {
  const result = analysis([FACULTY_HEADERS, FACULTY_ROW], "FACULTY", { isOfficialTemplate: true });
  assert.equal(result.document.documentType, "OFFICIAL_HAUTO_TEMPLATE");
  assert.equal(result.mappingStatus, "READY");
});

test("C ordinary Student masterlist is READY", () => {
  assert.equal(analysis([STUDENT_HEADERS, STUDENT_ROW]).mappingStatus, "READY");
});

test("D ordinary Faculty CSV matrix is READY", () => {
  assert.equal(analysis([FACULTY_HEADERS, FACULTY_ROW], "FACULTY").mappingStatus, "READY");
});

test("E a header after title rows is detected", () => {
  assert.equal(analysis([["University"], ["STUDENT MASTERLIST"], [], STUDENT_HEADERS, STUDENT_ROW]).selectedHeaderRow, 4);
});

test("F grade record receives deterministic classification", () => {
  assert.equal(analysis(gradeRecord()).document.documentType, "CLASS_GRADE_RECORD");
});

test("G grade header is structural but not H-Auto ready", () => {
  const result = analysis(gradeRecord());
  assert.equal(result.selectedHeaderRow, 15);
  assert.equal(result.headerCandidates[0].isStructuralHeader, true);
  assert.equal(result.mappingStatus, "NEEDS_MAPPING");
  assert.equal(result.headerCandidates[0].followingRecordCount, 2);
  assert.ok(result.headerCandidates[0].negativeEvidence.includes("quiz"));
});

test("H PROGRAM/YEAR&SECTION metadata is retained", () => {
  const result = analysis(gradeRecord());
  assert.equal(result.metadata.find((item) => item.label === "PROGRAM_YEAR_SECTION")?.value, "BSIT 1A");
});

test("I unsupported BSIT metadata is never canonicalized", () => {
  const item = analysis(gradeRecord()).metadata.find((entry) => entry.label === "PROGRAM_YEAR_SECTION");
  assert.equal(item?.status, "UNSUPPORTED_VALUE");
  assert.equal(item?.canonicalValue, null);
});

test("J unique canonical metadata safely supplies cohort fields", () => {
  const result = analysis([
    ["PROGRAM", "BS Agriculture - Animal Science"],
    ["YEAR LEVEL", "4"],
    ["SECTION", "BSA 4A"],
    ["First Name", "Last Name", "Email", "Student Number"],
    ["Lina", "Santos", "lina.santos@bpsu.edu.ph", "23-00123"],
  ], "STUDENT_FARMER", { forcedHeaderRow: 4 });
  assert.equal(result.fieldSources.course?.kind, "DOCUMENT_METADATA");
  assert.equal(result.fieldSources.section?.value, "BSA-4A");
  assert.equal(result.mappingStatus, "READY");
});

test("K metadata above the selected header is extracted", () => {
  assert.ok(analysis([["ACADEMIC YEAR: 2026-2027"], STUDENT_HEADERS], "STUDENT_FARMER", { forcedHeaderRow: 2 }).metadata.length > 0);
});

test("L adjacent label and value metadata is extracted", () => {
  const items = extractDocumentMetadata(matrixFromValues([["COURSE CODE", "SYN101"]]), "Sheet", null);
  assert.equal(items[0].value, "SYN101");
});

test("M safely exposed merged-style label/value metadata is extracted", () => {
  const items = extractDocumentMetadata(matrixFromValues([["COLLEGE", "College of Technology", "", ""]]), "Sheet", null);
  assert.equal(items[0].originalLabel, "COLLEGE");
});

test("N serial-only trailing rows are skipped", () => {
  const result = analysis(gradeRecord());
  assert.equal(result.skippedRowCount, 3);
  assert.deepEqual(result.sourceRows.map((row) => row.rowNumber), [16, 17]);
});

test("O footer and signature rows are skipped", () => {
  assert.equal(classifyImportRow(9, [{ text: "PREPARED BY" }, { text: "SAMPLE PERSON" }]).classification, "FOOTER");
  assert.equal(classifyImportRow(10, [{ text: "TOTAL" }]).classification, "FOOTER");
});

test("P meaningful incomplete student names remain records", () => {
  assert.equal(classifyImportRow(2, [{ text: "1" }, { text: "SANTOS, LINA" }], { nameColumnIndex: 1 }).classification, "RECORD");
});

test("Q unrelated grade columns are ignored", () => {
  const columns = buildAutomaticColumns(["Quiz", "Activity", "Exam", "Total"], "STUDENT_FARMER");
  assert.ok(columns.every((column) => column.status === "IGNORED"));
});

test("R duplicate unrelated display labels remain safely ignored", () => {
  const columns = buildAutomaticColumns(["TOTAL", "EQUIV", "TOTAL", "EQUIV"], "STUDENT_FARMER");
  assert.ok(columns.every((column) => column.status === "IGNORED"));
});

test("duplicate unrelated grade columns do not block an otherwise ready header", () => {
  const result = analysis([[...STUDENT_HEADERS, "TOTAL", "TOTAL"], [...STUDENT_ROW, "10", "20"]]);
  assert.equal(result.mappingStatus, "READY");
});

test("S duplicate relevant candidates need review", () => {
  assert.ok(buildAutomaticColumns(["Email", "EMAIL"], "STUDENT_FARMER").every((column) => column.status === "AMBIGUOUS"));
});

test("mapping ambiguity remains a user-facing review state", () => {
  const result = analysis([[...STUDENT_HEADERS, "EMAIL"]], "STUDENT_FARMER", { forcedHeaderRow: 1 });
  assert.equal(result.mappingStatus, "AMBIGUOUS");
  assert.equal(result.document.status, "NEEDS_REVIEW");
});

test("T comma-separated full name yields a reviewable suggestion", () => {
  const suggestion = parseReviewedFullName("SANTOS, LINA MARIE");
  assert.deepEqual([suggestion?.firstName, suggestion?.middleName, suggestion?.lastName], ["LINA", "MARIE", "SANTOS"]);
});

test("U Unicode names are preserved", () => {
  assert.equal(parseReviewedFullName("PEÑA, NIÑA")?.lastName, "PEÑA");
  assert.equal(parseReviewedFullName("PEÑA, NIÑA")?.firstName, "NIÑA");
});

test("V a clearly placed suffix is preserved with lastName", () => {
  const suggestion = parseReviewedFullName("CRUZ, JUAN Q. JR.");
  assert.equal(suggestion?.suffix, "JR.");
  assert.equal(suggestion?.lastName, "CRUZ JR.");
});

test("W full names without a comma remain ambiguous", () => {
  assert.equal(parseReviewedFullName("LINA MARIE SANTOS")?.status, "AMBIGUOUS");
});

test("X multiple section metadata prevents one global source", () => {
  const metadata = extractDocumentMetadata(matrixFromValues([["SECTION: BSA 1A"], ["SECTION: BSA 1B"]]), "Sheet", null);
  assert.equal(uniqueSafeMetadataByField(metadata).section, undefined);
});

test("Y reviewed course constants are allowed", () => {
  const base = analysis([["First Name", "Last Name", "Email", "Student Number", "Year Level", "Section"]], "STUDENT_FARMER", { forcedHeaderRow: 1 });
  const updated = updateAnalysisFieldSource(base, "STUDENT_FARMER", "course", { kind: "REVIEWED_CONSTANT", value: "BS Agriculture - Animal Science" });
  assert.ok("analysis" in updated);
  assert.equal(updated.analysis.fieldSources.course?.value, "BS Agriculture - Animal Science");
});

test("Z unique ID constants are prohibited", () => {
  const base = analysis([["First Name", "Last Name", "Email", "Year Level", "Section", "Program"]], "STUDENT_FARMER", { forcedHeaderRow: 1 });
  const updated = updateAnalysisFieldSource(base, "STUDENT_FARMER", "idNumber", { kind: "REVIEWED_CONSTANT", value: "23-00123" });
  assert.ok("error" in updated);
});

test("identity fields reject forged document-metadata sources", () => {
  const base = analysis([["First Name", "Last Name", "Email", "Year Level", "Section", "Program"]], "STUDENT_FARMER", { forcedHeaderRow: 1 });
  const updated = updateAnalysisFieldSource(base, "STUDENT_FARMER", "idNumber", {
    kind: "DOCUMENT_METADATA",
    metadataId: "forged",
    value: "23-00123",
  });
  assert.ok("error" in updated);
});

test("AA a replacement analysis generation invalidates old decisions", () => {
  const tracker = { current: 0 };
  const first = advanceAnalysisGeneration(tracker);
  advanceAnalysisGeneration(tracker);
  assert.equal(isCurrentAnalysisGeneration(tracker, first), false);
});

test("AB changing sheets produces independent context", () => {
  const a = analysis([["SECTION: BSA 1A"], STUDENT_HEADERS], "STUDENT_FARMER", { forcedHeaderRow: 2 });
  const b = analysis([["SECTION: BSA 1B"], STUDENT_HEADERS], "STUDENT_FARMER", { forcedHeaderRow: 2 });
  assert.notEqual(a.metadata[0].value, b.metadata[0].value);
});

test("AC changing the header recalculates mappings", () => {
  const values = [["First Name", "Last Name", "Email", "Student Number"], STUDENT_HEADERS, STUDENT_ROW];
  assert.notEqual(analysis(values, "STUDENT_FARMER", { forcedHeaderRow: 1 }).mappingStatus, analysis(values, "STUDENT_FARMER", { forcedHeaderRow: 2 }).mappingStatus);
});

test("AD duplicate identities in a file retain structured issue codes", () => {
  const raw = Object.fromEntries(STUDENT_HEADERS.map((header, index) => [buildAutomaticColumns(STUDENT_HEADERS, "STUDENT_FARMER")[index].mappedField!, STUDENT_ROW[index]]));
  const result = analyzeImportRows("STUDENT_FARMER", [{ rowNumber: 2, raw }, { rowNumber: 3, raw }]);
  assert.ok(!("error" in result));
  assert.ok(result.rows[0].issues.some((issue) => issue.code === "DUPLICATE_ID_FILE"));
});

test("AE existing users are distinguished from in-file duplicates", () => {
  const raw = { firstName: "Ana", middleName: "", lastName: "Cruz", email: "ana.cruz@bpsu.edu.ph", phoneNumber: "", idNumber: "202000-0001", department: "BS Agriculture - Animal Science", position: "Instructor I" };
  const checked = analyzeImportRows("FACULTY", [{ rowNumber: 2, raw }]);
  assert.ok(!("error" in checked));
  const result = applyExistingUserConflicts(checked, [{ email: raw.email, idNumber: null, phoneNumber: null }]);
  assert.ok(result.rows[0].issues.some((issue) => issue.code === "EMAIL_EXISTS"));
});

test("AF conflicting stored identity remains blocked", () => {
  const raw = { firstName: "Ana", middleName: "", lastName: "Cruz", email: "ana.cruz@bpsu.edu.ph", phoneNumber: "", idNumber: "202000-0001", department: "BS Agriculture - Animal Science", position: "Instructor I" };
  const checked = analyzeImportRows("FACULTY", [{ rowNumber: 2, raw }]);
  assert.ok(!("error" in checked));
  const result = applyExistingUserConflicts(checked, [{ email: "other@bpsu.edu.ph", idNumber: raw.idNumber, phoneNumber: null }]);
  assert.ok(result.rows[0].issues.some((issue) => issue.code === "ID_EXISTS"));
});

test("AG invalid academic progression remains blocked", () => {
  const raw = Object.fromEntries(STUDENT_HEADERS.map((header, index) => [buildAutomaticColumns(STUDENT_HEADERS, "STUDENT_FARMER")[index].mappedField!, STUDENT_ROW[index]]));
  raw.yearLevel = "1st Year";
  const result = analyzeImportRows("STUDENT_FARMER", [{ rowNumber: 2, raw }]);
  assert.ok(!("error" in result));
  assert.equal(result.rows[0].eligible, false);
});

test("AH an invalid reviewed constant is rejected by server validation", () => {
  const base = analysis([["First Name", "Last Name", "Email", "Student Number", "Year Level", "Section"], ["Lina", "Santos", "lina.santos@bpsu.edu.ph", "23-00123", "4th Year", "BSA-4A"]], "STUDENT_FARMER", { forcedHeaderRow: 1 });
  const updated = updateAnalysisFieldSource(base, "STUDENT_FARMER", "course", { kind: "REVIEWED_CONSTANT", value: "BSIT" });
  assert.ok("analysis" in updated);
  const checked = analyzeImportRows("STUDENT_FARMER", mapSourceRows(updated.analysis));
  assert.ok(!("error" in checked));
  assert.equal(checked.rows[0].eligible, false);
});

test("AI role mismatch produces a warning without changing selected type", () => {
  const result = analysis([["STUDENT MASTERLIST"], STUDENT_HEADERS, STUDENT_ROW], "FACULTY", { forcedHeaderRow: 2 });
  assert.match(result.document.importTypeWarning ?? "", /student-oriented/i);
});

test("AJ mixed-role masterlists are not silently split", () => {
  const result = analysis([["STUDENT AND FACULTY MASTERLIST"], FACULTY_HEADERS], "FACULTY", { forcedHeaderRow: 2 });
  assert.equal(result.document.documentType, "MIXED_MASTERLIST");
  assert.match(result.document.importTypeWarning ?? "", /mixed roles/i);
});

test("AK missing Student ID produces missing information", () => {
  const headers = STUDENT_HEADERS.filter((header) => header !== "Student Number");
  assert.equal(analysis([headers], "STUDENT_FARMER", { forcedHeaderRow: 1 }).document.status, "MISSING_REQUIRED_INFORMATION");
});

test("AL missing email produces missing information", () => {
  const headers = STUDENT_HEADERS.filter((header) => header !== "Email");
  assert.equal(analysis([headers], "STUDENT_FARMER", { forcedHeaderRow: 1 }).document.status, "MISSING_REQUIRED_INFORMATION");
});

test("AM unsupported course context never becomes a mapping source", () => {
  const result = analysis(gradeRecord());
  assert.equal(result.fieldSources.course, undefined);
  assert.ok(result.missingRequiredFields.includes("course"));
});

test("AN clean masterlists avoid unnecessary manual mapping", () => {
  const result = analysis([STUDENT_HEADERS, STUDENT_ROW]);
  assert.ok(result.columns.every((column) => column.status === "AUTO_MAPPED"));
});

test("AO equivalent plausible headers require review", () => {
  const result = analysis([STUDENT_HEADERS, STUDENT_HEADERS, STUDENT_ROW]);
  const candidates = result.headerCandidates;
  assert.equal(selectDetectedHeader(candidates), null);
  assert.equal(result.document.status, "NEEDS_REVIEW");
});

test("reviewed full names apply only after explicit acceptance", () => {
  const base = analysis([["NO", "STUDENTS", "Email", "Student Number", "Program", "Year Level", "Section"], ["1", "SANTOS, LINA M", "lina.santos@bpsu.edu.ph", "23-00123", "BS Agriculture - Animal Science", "4th Year", "BSA-4A"]], "STUDENT_FARMER");
  const source = base.columns.find((column) => column.normalizedHeader === "students")!;
  assert.ok(base.missingRequiredFields.includes("firstName"));
  const updated = updateReviewedFullNameSource(base, "STUDENT_FARMER", source.sourceIndex);
  assert.ok("analysis" in updated);
  assert.equal(mapSourceRows(updated.analysis)[0].raw.lastName, "SANTOS");
});

test("scientific or numeric IDs receive a non-guessing parsing error", () => {
  const result = analysis([["First Name", "Last Name", "Email", "Student Number", "Program", "Year Level", "Section"], ["Lina", "Santos", "lina.santos@bpsu.edu.ph", "2.300123E+6", "BS Agriculture - Animal Science", "4th Year", "BSA-4A"]]);
  assert.match(mapSourceRows(result)[0].parsingErrors.join(" "), /changed this ID into a number/);
});

test("manual mappings still use stable source indexes", () => {
  const base = analysis([["First Name", "Last Name", "Email", "Identifier", "Department", "Position"]], "FACULTY", { forcedHeaderRow: 1 });
  const index = base.columns.find((column) => column.sourceHeader === "Identifier")!.sourceIndex;
  const updated = updateAnalysisMapping(base, "FACULTY", index, "idNumber");
  assert.ok("analysis" in updated);
  assert.equal(updated.analysis.columns[index].mappedField, "idNumber");
});
