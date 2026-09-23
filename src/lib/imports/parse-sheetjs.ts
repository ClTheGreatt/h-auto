import * as XLSX from "xlsx";
import { buildParsedRows, type ParsedRow } from "./parse-rows";
import {
  importFileFailure,
  isPasswordProtectedParserError,
  type ImportFileFailure,
  type ImportFileFormat,
} from "./file-format";
import type { ImportRowType } from "@/lib/validations/import";
import {
  importTypeMismatchMessage,
  parseImportTypeMarker,
} from "@/lib/constants/user-import";
import {
  MAX_HEADER_SCAN_ROWS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_DATA_ROWS,
  MAX_IMPORT_WORKSHEETS,
  analyzeImportMatrix,
  detectHeaderCandidates,
  mapSourceRows,
  selectDetectedHeader,
  selectClearlySuperiorSheet,
  type ImportCell,
  type ImportMatrixAnalysis,
  type ImportMatrixRow,
  type ImportSheetCandidate,
} from "./masterlist-mapping";
import type {
  ParseWorkbookSuccess,
  ParseExcelOptions,
} from "./parse-excel";

export type ParseSheetJsResult = ParseWorkbookSuccess | ImportFileFailure;

const MAX_PARSED_SHEET_ROWS =
  MAX_HEADER_SCAN_ROWS + MAX_IMPORT_DATA_ROWS + 1;

function cellText(cell: XLSX.CellObject): string {
  if (typeof cell.w === "string") return cell.w;
  if (cell.v === undefined || cell.v === null) return "";
  return cell.v instanceof Date ? cell.v.toISOString() : String(cell.v);
}

export function sheetJsCellToImportCell(
  cell: XLSX.CellObject | undefined
): ImportCell {
  if (!cell) return { text: "" };
  return {
    text: cellText(cell),
    ...(typeof cell.f === "string" ? { isFormula: true } : {}),
    ...(cell.t === "e" ? { isError: true } : {}),
  };
}

function worksheetRange(sheet: XLSX.WorkSheet): XLSX.Range | null {
  const reference = sheet["!ref"];
  if (!reference) return null;
  try {
    return XLSX.utils.decode_range(reference);
  } catch {
    return null;
  }
}

function fullWorksheetRange(sheet: XLSX.WorkSheet): XLSX.Range | null {
  const fullReference = sheet["!fullref"];
  if (typeof fullReference === "string") {
    try {
      return XLSX.utils.decode_range(fullReference);
    } catch {
      return null;
    }
  }
  return worksheetRange(sheet);
}

function worksheetMatrix(
  sheet: XLSX.WorkSheet,
  maximumRows = MAX_HEADER_SCAN_ROWS + MAX_IMPORT_DATA_ROWS
): ImportMatrixRow[] {
  const range = worksheetRange(sheet);
  if (!range) return [];
  const lastRow = Math.min(range.e.r, maximumRows - 1);
  const lastColumn = Math.min(range.e.c, MAX_IMPORT_COLUMNS - 1);
  const rows: ImportMatrixRow[] = [];

  for (let rowIndex = range.s.r; rowIndex <= lastRow; rowIndex += 1) {
    const cells = Array.from(
      { length: lastColumn + 1 },
      (_, columnIndex) =>
        sheetJsCellToImportCell(
          sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] as
            | XLSX.CellObject
            | undefined
        )
    );
    if (
      cells.some(
        (cell) => cell.isFormula || cell.isError || cell.text.trim() !== ""
      )
    ) {
      rows.push({ rowNumber: rowIndex + 1, cells });
    }
  }
  return rows;
}

function headerMatrix(sheet: XLSX.WorkSheet): ImportMatrixRow[] {
  return worksheetMatrix(sheet, MAX_HEADER_SCAN_ROWS);
}

function sheetCandidate(
  name: string,
  sheet: XLSX.WorkSheet,
  importType: ImportRowType
): ImportSheetCandidate {
  const candidates = detectHeaderCandidates(headerMatrix(sheet), importType);
  const selected = selectDetectedHeader(candidates);
  return {
    name,
    headerCandidates: candidates,
    selectedHeaderRow: selected?.rowNumber ?? null,
    hasQualifiedCandidate: candidates.some((candidate) => candidate.qualifies),
  };
}

function parsedRowsForAnalysis(
  analysis: ImportMatrixAnalysis,
  importType: ImportRowType
): ParsedRow[] | null {
  if (analysis.mappingStatus !== "READY") return null;
  const mapped = mapSourceRows(analysis);
  return buildParsedRows(
    mapped.map((row) => row.raw),
    importType,
    {
      rowNumbers: mapped.map((row) => row.rowNumber),
      parsingErrors: mapped.map((row) => row.parsingErrors),
    }
  );
}

function ambiguousResult(
  format: ImportFileFormat,
  sheets: ImportSheetCandidate[],
  selectedSheet: string | null,
  analysis: ImportMatrixAnalysis | null = null
): ParseWorkbookSuccess {
  return {
    fileType: format,
    isTemplateWorkbook: false,
    sheets,
    selectedSheet,
    mappingStatus: "AMBIGUOUS",
    analysis,
    rows: null,
    hasLegacyPasswordColumn: analysis?.hasLegacyPasswordColumn ?? false,
  };
}

function selectedSheetLimitFailure(
  name: string,
  sheet: XLSX.WorkSheet
): ImportFileFailure | null {
  const range = fullWorksheetRange(sheet);
  if (!range) return null;
  if (range.e.c + 1 > MAX_IMPORT_COLUMNS) {
    return importFileFailure(
      "TOO_MANY_COLUMNS",
      `Worksheet "${name}" has more than ${MAX_IMPORT_COLUMNS} columns. Remove unused columns and try again.`
    );
  }
  if (range.e.r + 1 > MAX_HEADER_SCAN_ROWS + MAX_IMPORT_DATA_ROWS) {
    return importFileFailure(
      "TOO_MANY_ROWS",
      `Worksheet "${name}" has more than ${MAX_IMPORT_DATA_ROWS} data rows. Split it into smaller files and try again.`
    );
  }
  return null;
}

function analyzeWorksheet(
  format: ImportFileFormat,
  name: string,
  sheet: XLSX.WorkSheet,
  sheets: ImportSheetCandidate[],
  importType: ImportRowType,
  selectedHeaderRow?: number,
  isTemplateWorkbook = false
): ParseSheetJsResult {
  const limitFailure = selectedSheetLimitFailure(name, sheet);
  if (limitFailure) return limitFailure;
  const analyzed = analyzeImportMatrix(worksheetMatrix(sheet), importType, {
    fileType: format,
    sheetName: name,
    isOfficialTemplate: isTemplateWorkbook,
    ...(selectedHeaderRow !== undefined
      ? { forcedHeaderRow: selectedHeaderRow }
      : {}),
  });
  if ("error" in analyzed) {
    const errorCode = analyzed.error.includes("columns")
      ? "TOO_MANY_COLUMNS"
      : analyzed.error.includes("rows")
        ? "TOO_MANY_ROWS"
        : "PARSE_ERROR";
    return importFileFailure(errorCode, analyzed.error);
  }

  const { analysis } = analyzed;
  return {
    fileType: format,
    isTemplateWorkbook,
    sheets,
    selectedSheet: name,
    mappingStatus: analysis.mappingStatus,
    analysis,
    rows: parsedRowsForAnalysis(analysis, importType),
    hasLegacyPasswordColumn: analysis.hasLegacyPasswordColumn,
  };
}

function canonicalOppositeType(
  name: string,
  sheet: XLSX.WorkSheet,
  selectedType: ImportRowType
): ImportRowType | null {
  const otherType: ImportRowType =
    selectedType === "FACULTY" ? "STUDENT_FARMER" : "FACULTY";
  const otherCandidate = sheetCandidate(name, sheet, otherType);
  return otherCandidate.selectedHeaderRow === null ? null : otherType;
}

function isVisibleSheet(
  workbook: XLSX.WorkBook,
  name: string
): boolean {
  const metadata = workbook.Workbook?.Sheets?.find(
    (sheet) => sheet.name === name
  );
  return (metadata?.Hidden ?? 0) === 0;
}

export async function parseSheetJsImportFile(
  arrayBuffer: ArrayBuffer,
  format: "xls" | "xlsx" | "xlsm",
  importType: ImportRowType,
  options: ParseExcelOptions = {}
): Promise<ParseSheetJsResult> {
  try {
    const workbook = XLSX.read(Buffer.from(arrayBuffer), {
      type: "buffer",
      bookVBA: false,
      bookFiles: false,
      bookDeps: false,
      cellFormula: true,
      cellHTML: false,
      cellStyles: false,
      cellText: true,
      sheetRows: MAX_PARSED_SHEET_ROWS,
      WTF: false,
    });

    const visibleSheetNames = workbook.SheetNames.filter((name) =>
      isVisibleSheet(workbook, name)
    );
    if (visibleSheetNames.length === 0) {
      return importFileFailure(
        "PARSE_ERROR",
        "Could not find a visible worksheet in this Excel file."
      );
    }
    if (visibleSheetNames.length > MAX_IMPORT_WORKSHEETS) {
      return importFileFailure(
        "TOO_MANY_SHEETS",
        `This workbook has more than ${MAX_IMPORT_WORKSHEETS} visible worksheets. Remove unused sheets and try again.`
      );
    }

    const oversizedSheet = visibleSheetNames.find((name) => {
      const range = fullWorksheetRange(workbook.Sheets[name]);
      return !!range && range.e.c + 1 > MAX_IMPORT_COLUMNS;
    });
    if (oversizedSheet) {
      return importFileFailure(
        "TOO_MANY_COLUMNS",
        `Worksheet "${oversizedSheet}" has more than ${MAX_IMPORT_COLUMNS} columns. Remove unused columns and try again.`
      );
    }

    const candidates = visibleSheetNames.map((name) =>
      sheetCandidate(name, workbook.Sheets[name], importType)
    );
    const markerType = parseImportTypeMarker(workbook.Sheets.Lists?.D1?.v);
    if (markerType && markerType !== importType) {
      return importFileFailure(
        "PARSE_ERROR",
        importTypeMismatchMessage(importType, markerType)
      );
    }
    if (markerType === importType) {
      const dataSheet = workbook.Sheets.Data;
      if (!dataSheet) {
        return importFileFailure(
          "CORRUPT_OR_UNREADABLE",
          "The H-Auto template marker is present, but the Data sheet is missing."
        );
      }
      return analyzeWorksheet(
        format,
        "Data",
        dataSheet,
        candidates.filter((candidate) => candidate.name === "Data"),
        importType,
        1,
        true
      );
    }

    if (options.selectedSheet) {
      if (!visibleSheetNames.includes(options.selectedSheet)) {
        return importFileFailure(
          "PARSE_ERROR",
          "The selected worksheet is not available or is hidden."
        );
      }
      const sheet = workbook.Sheets[options.selectedSheet];
      if (options.selectedHeaderRow !== undefined) {
        return analyzeWorksheet(
          format,
          options.selectedSheet,
          sheet,
          candidates,
          importType,
          options.selectedHeaderRow
        );
      }
      const selectedCandidate = candidates.find(
        (candidate) => candidate.name === options.selectedSheet
      )!;
      if (selectedCandidate.selectedHeaderRow !== null) {
        return analyzeWorksheet(
          format,
          options.selectedSheet,
          sheet,
          candidates,
          importType,
          selectedCandidate.selectedHeaderRow
        );
      }
      const partial = analyzeImportMatrix(headerMatrix(sheet), importType, {
        fileType: format,
        sheetName: options.selectedSheet,
      });
      return "error" in partial
        ? importFileFailure("PARSE_ERROR", partial.error)
        : ambiguousResult(
            format,
            candidates,
            options.selectedSheet,
            partial.analysis
          );
    }

    const clearSheets = candidates.filter(
      (candidate) => candidate.selectedHeaderRow !== null
    );
    const superiorSheet = selectClearlySuperiorSheet(candidates);
    if (superiorSheet) {
      const selected = superiorSheet;
      return analyzeWorksheet(
        format,
        selected.name,
        workbook.Sheets[selected.name],
        candidates,
        importType,
        selected.selectedHeaderRow!
      );
    }

    if (clearSheets.length === 0) {
      const otherClear = visibleSheetNames.filter(
        (name) =>
          canonicalOppositeType(name, workbook.Sheets[name], importType) !==
          null
      );
      if (otherClear.length === 1) {
        const otherType: ImportRowType =
          importType === "FACULTY" ? "STUDENT_FARMER" : "FACULTY";
        return importFileFailure(
          "PARSE_ERROR",
          importTypeMismatchMessage(importType, otherType)
        );
      }
      if (visibleSheetNames.length === 1) {
        const name = visibleSheetNames[0];
        const partial = analyzeImportMatrix(
          headerMatrix(workbook.Sheets[name]),
          importType,
          { fileType: format, sheetName: name }
        );
        return "error" in partial
          ? importFileFailure("PARSE_ERROR", partial.error)
          : ambiguousResult(format, candidates, name, partial.analysis);
      }
    }

    return ambiguousResult(format, candidates, null);
  } catch (error) {
    if (isPasswordProtectedParserError(error)) {
      return importFileFailure("PASSWORD_PROTECTED");
    }
    return importFileFailure("CORRUPT_OR_UNREADABLE");
  }
}
