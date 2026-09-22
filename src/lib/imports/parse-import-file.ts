import {
  contentMismatchFailure,
  detectImportFile,
  importFileFailure,
  isImportFileFailure,
  type ImportFileErrorCode,
  type ImportFileFailure,
} from "./file-format";
import {
  parseExcelImportFile,
  type ParseExcelOptions,
  type ParseWorkbookSuccess,
} from "./parse-excel";
import { inspectOoxmlWorkbookKind } from "./inspect-ooxml";
import { parseSheetJsImportFile } from "./parse-sheetjs";
import type { ImportRowType } from "@/lib/validations/import";

export type ParseImportFileResult =
  | ParseWorkbookSuccess
  | ImportFileFailure;

function codeForExistingParserError(message: string): ImportFileErrorCode {
  if (message.includes("visible worksheets")) return "TOO_MANY_SHEETS";
  if (message.includes("columns")) return "TOO_MANY_COLUMNS";
  if (message.includes("data rows")) return "TOO_MANY_ROWS";
  if (message.includes("password-protected")) return "PASSWORD_PROTECTED";
  if (message.includes("couldn't read this Excel workbook")) {
    return "CORRUPT_OR_UNREADABLE";
  }
  return "PARSE_ERROR";
}

export async function parseImportWorkbookFile(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  importType: ImportRowType,
  options: ParseExcelOptions = {}
): Promise<ParseImportFileResult> {
  const detected = detectImportFile(fileName, new Uint8Array(arrayBuffer));
  if (isImportFileFailure(detected)) return detected;
  if (detected.format === "csv") {
    return importFileFailure(
      "PARSE_ERROR",
      "CSV files are read directly in the browser before secure server validation."
    );
  }

  if (detected.format === "xls") {
    return parseSheetJsImportFile(arrayBuffer, "xls", importType, options);
  }

  const ooxmlKind = inspectOoxmlWorkbookKind(arrayBuffer);
  if (typeof ooxmlKind !== "string") return ooxmlKind;
  if (ooxmlKind !== detected.format) {
    return contentMismatchFailure(`.${detected.format}`);
  }
  if (ooxmlKind === "xlsm") {
    return parseSheetJsImportFile(arrayBuffer, "xlsm", importType, options);
  }

  const result = await parseExcelImportFile(arrayBuffer, importType, options);
  if ("error" in result) {
    return importFileFailure(
      result.errorCode ?? codeForExistingParserError(result.error),
      result.error
    );
  }
  return result;
}
