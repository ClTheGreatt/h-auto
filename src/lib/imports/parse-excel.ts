import ExcelJS from "exceljs";
import { buildParsedRows, type ParsedRow } from "./parse-rows";
import type { ImportRowType } from "@/lib/validations/import";
import {
  detectImportTypeMismatch,
  parseImportTypeMarker,
  importTypeMismatchMessage,
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
  type ImportCell,
  type ImportMatrixAnalysis,
  type ImportMatrixRow,
  type ImportSheetCandidate,
  type ImportMappingStatus,
} from "./masterlist-mapping";

export type ParseExcelSuccess = {
  fileType: "xlsx";
  isTemplateWorkbook: boolean;
  sheets: ImportSheetCandidate[];
  selectedSheet: string | null;
  mappingStatus: ImportMappingStatus;
  analysis: ImportMatrixAnalysis | null;
  rows: ParsedRow[] | null;
  hasLegacyPasswordColumn: boolean;
};

export type ParseExcelResult = ParseExcelSuccess | { error: string };
export type ParseExcelResponse = Omit<ParseExcelSuccess, "rows">;

export type ParseExcelOptions = {
  selectedSheet?: string;
  selectedHeaderRow?: number;
};

function excelCell(cell: ExcelJS.Cell): ImportCell {
  const value = cell.value;
  const isFormula =
    cell.type === ExcelJS.ValueType.Formula ||
    (!!value &&
      typeof value === "object" &&
      ("formula" in value || "sharedFormula" in value));
  const isError =
    cell.type === ExcelJS.ValueType.Error ||
    (!!value && typeof value === "object" && "error" in value);

  return {
    text: cell.text ?? "",
    ...(isFormula ? { isFormula: true } : {}),
    ...(isError ? { isError: true } : {}),
  };
}

function headerMatrix(sheet: ExcelJS.Worksheet): ImportMatrixRow[] {
  const width = Math.min(sheet.actualColumnCount, MAX_IMPORT_COLUMNS);
  const rows: ImportMatrixRow[] = [];
  const lastRow = Math.min(sheet.rowCount, MAX_HEADER_SCAN_ROWS);

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    rows.push({
      rowNumber,
      cells: Array.from({ length: width }, (_, index) =>
        excelCell(row.getCell(index + 1))
      ),
    });
  }
  return rows;
}

function selectedSheetMatrix(
  sheet: ExcelJS.Worksheet
): ImportMatrixRow[] | { error: string } {
  if (sheet.actualColumnCount > MAX_IMPORT_COLUMNS) {
    return {
      error: `Worksheet "${sheet.name}" has more than ${MAX_IMPORT_COLUMNS} columns. Remove unused columns and try again.`,
    };
  }

  // At most 20 populated rows can precede/contain the header. Anything
  // beyond that plus the 250-row import cap necessarily exceeds the data
  // bound, so fail before walking a large worksheet.
  if (sheet.actualRowCount > MAX_HEADER_SCAN_ROWS + MAX_IMPORT_DATA_ROWS) {
    return {
      error: `Worksheet "${sheet.name}" has more than ${MAX_IMPORT_DATA_ROWS} data rows. Split it into smaller files and try again.`,
    };
  }

  const width = sheet.actualColumnCount;
  const rows: ImportMatrixRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    rows.push({
      rowNumber,
      cells: Array.from({ length: width }, (_, index) =>
        excelCell(row.getCell(index + 1))
      ),
    });
  });
  return rows;
}

function sheetCandidate(
  sheet: ExcelJS.Worksheet,
  importType: ImportRowType
): ImportSheetCandidate {
  const candidates = detectHeaderCandidates(headerMatrix(sheet), importType);
  const selected = selectDetectedHeader(candidates);
  return {
    name: sheet.name,
    headerCandidates: candidates,
    selectedHeaderRow: selected?.rowNumber ?? null,
    hasQualifiedCandidate: candidates.some((candidate) => candidate.qualifies),
  };
}

function canonicalOppositeType(
  sheet: ExcelJS.Worksheet,
  selectedType: ImportRowType
): ImportRowType | null {
  const otherType: ImportRowType =
    selectedType === "FACULTY" ? "STUDENT_FARMER" : "FACULTY";
  const otherCandidate = sheetCandidate(sheet, otherType);
  if (otherCandidate.selectedHeaderRow === null) return null;

  const row = headerMatrix(sheet).find(
    (candidate) => candidate.rowNumber === otherCandidate.selectedHeaderRow
  );
  if (!row) return null;
  return detectImportTypeMismatch(
    row.cells.map((cell) => cell.text),
    selectedType
  );
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
  sheets: ImportSheetCandidate[],
  selectedSheet: string | null,
  analysis: ImportMatrixAnalysis | null = null
): ParseExcelSuccess {
  return {
    fileType: "xlsx",
    isTemplateWorkbook: false,
    sheets,
    selectedSheet,
    mappingStatus: "AMBIGUOUS",
    analysis,
    rows: null,
    hasLegacyPasswordColumn: analysis?.hasLegacyPasswordColumn ?? false,
  };
}

function analyzeWorksheet(
  sheet: ExcelJS.Worksheet,
  sheets: ImportSheetCandidate[],
  importType: ImportRowType,
  selectedHeaderRow?: number,
  isTemplateWorkbook = false
): ParseExcelResult {
  const matrix = selectedSheetMatrix(sheet);
  if ("error" in matrix) return matrix;

  const analyzed = analyzeImportMatrix(matrix, importType, {
    fileType: "xlsx",
    sheetName: sheet.name,
    ...(selectedHeaderRow !== undefined ? { forcedHeaderRow: selectedHeaderRow } : {}),
  });
  if ("error" in analyzed) return analyzed;

  const { analysis } = analyzed;
  return {
    fileType: "xlsx",
    isTemplateWorkbook,
    sheets,
    selectedSheet: sheet.name,
    mappingStatus: analysis.mappingStatus,
    analysis,
    rows: parsedRowsForAnalysis(analysis, importType),
    hasLegacyPasswordColumn: analysis.hasLegacyPasswordColumn,
  };
}

// Loads an uploaded .xlsx workbook once, discovers only bounded visible
// worksheet/header metadata, and returns a serializable mapping model. The
// web route can ask for a specific sheet/header on a later request while the
// mobile route keeps working for files that auto-map without intervention.
export async function parseExcelImportFile(
  buffer: ArrayBuffer,
  importType: ImportRowType,
  options: ParseExcelOptions = {}
): Promise<ParseExcelResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const visibleSheets = workbook.worksheets.filter(
      (sheet) => sheet.state === "visible"
    );
    if (visibleSheets.length === 0) {
      return { error: "Could not find a visible worksheet in this Excel file." };
    }
    if (visibleSheets.length > MAX_IMPORT_WORKSHEETS) {
      return {
        error: `This workbook has more than ${MAX_IMPORT_WORKSHEETS} visible worksheets. Remove unused sheets and try again.`,
      };
    }
    const oversizedSheet = visibleSheets.find(
      (sheet) => sheet.actualColumnCount > MAX_IMPORT_COLUMNS
    );
    if (oversizedSheet) {
      return {
        error: `Worksheet "${oversizedSheet.name}" has more than ${MAX_IMPORT_COLUMNS} columns. Remove unused columns and try again.`,
      };
    }

    const candidates = visibleSheets.map((sheet) =>
      sheetCandidate(sheet, importType)
    );

    const listsSheet = workbook.getWorksheet("Lists");
    const markerType = listsSheet
      ? parseImportTypeMarker(listsSheet.getCell(1, 4).value)
      : null;

    if (markerType && markerType !== importType) {
      return { error: importTypeMismatchMessage(importType, markerType) };
    }

    // Official templates bypass heuristics: the marker and Data sheet are
    // authoritative, preserving the existing row-1 fast path exactly.
    if (markerType === importType) {
      const dataSheet = workbook.getWorksheet("Data");
      if (!dataSheet) {
        return { error: "The H-Auto template marker is present, but the Data sheet is missing." };
      }
      const dataCandidate = candidates.filter(
        (candidate) => candidate.name === dataSheet.name
      );
      return analyzeWorksheet(dataSheet, dataCandidate, importType, 1, true);
    }

    if (options.selectedSheet) {
      const selected = visibleSheets.find(
        (sheet) => sheet.name === options.selectedSheet
      );
      if (!selected) {
        return { error: "The selected worksheet is not available or is hidden." };
      }

      if (options.selectedHeaderRow !== undefined) {
        return analyzeWorksheet(
          selected,
          candidates,
          importType,
          options.selectedHeaderRow
        );
      }

      const selectedCandidate = candidates.find(
        (candidate) => candidate.name === selected.name
      )!;
      if (selectedCandidate.selectedHeaderRow !== null) {
        return analyzeWorksheet(
          selected,
          candidates,
          importType,
          selectedCandidate.selectedHeaderRow
        );
      }

      const partial = analyzeImportMatrix(headerMatrix(selected), importType, {
        fileType: "xlsx",
        sheetName: selected.name,
      });
      return "error" in partial
        ? partial
        : ambiguousResult(candidates, selected.name, partial.analysis);
    }

    const clearSheets = candidates.filter(
      (candidate) => candidate.selectedHeaderRow !== null
    );
    if (clearSheets.length === 1) {
      const selected = visibleSheets.find(
        (sheet) => sheet.name === clearSheets[0].name
      )!;
      return analyzeWorksheet(
        selected,
        candidates,
        importType,
        clearSheets[0].selectedHeaderRow!
      );
    }

    // Preserve the old wrong-template guidance for unmarked files when the
    // opposite role has one clear match and the selected role has none.
    if (clearSheets.length === 0) {
      const otherClear = visibleSheets.filter(
        (sheet) => canonicalOppositeType(sheet, importType) !== null
      );
      if (otherClear.length === 1) {
        const otherType: ImportRowType =
          importType === "FACULTY" ? "STUDENT_FARMER" : "FACULTY";
        return { error: importTypeMismatchMessage(importType, otherType) };
      }

      // One visible sheet is not a worksheet ambiguity. Keep it selected so
      // the UI can immediately ask for the header row instead of presenting
      // a redundant one-item sheet picker.
      if (visibleSheets.length === 1) {
        const selected = visibleSheets[0];
        const partial = analyzeImportMatrix(headerMatrix(selected), importType, {
          fileType: "xlsx",
          sheetName: selected.name,
        });
        return "error" in partial
          ? partial
          : ambiguousResult(candidates, selected.name, partial.analysis);
      }
    }

    return ambiguousResult(candidates, null);
  } catch (err) {
    return {
      error: `Failed to parse Excel file: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    };
  }
}
