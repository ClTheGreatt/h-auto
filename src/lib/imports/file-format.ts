import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants/user-import";

export const SUPPORTED_IMPORT_FILE_FORMATS = [
  "csv",
  "xls",
  "xlsx",
  "xlsm",
] as const;

export type ImportFileFormat = (typeof SUPPORTED_IMPORT_FILE_FORMATS)[number];

export type ImportFileContentKind =
  | "text"
  | "ooxml"
  | "ole"
  | "biff"
  | "binary";

export type ImportFileErrorCode =
  | "EMPTY_FILE"
  | "UNSUPPORTED_FORMAT"
  | "CONTENT_TYPE_MISMATCH"
  | "PASSWORD_PROTECTED"
  | "CORRUPT_OR_UNREADABLE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_SHEETS"
  | "TOO_MANY_COLUMNS"
  | "TOO_MANY_ROWS"
  | "PARSE_ERROR";

export type ImportFileFailure = {
  error: string;
  errorCode: ImportFileErrorCode;
};

export type DetectedImportFile = {
  format: ImportFileFormat;
  contentKind: ImportFileContentKind;
};

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];

const STATIC_ERROR_MESSAGES: Record<
  Exclude<ImportFileErrorCode, "CONTENT_TYPE_MISMATCH">,
  string
> = {
  EMPTY_FILE: "This file is empty. Choose a CSV or Excel file with data.",
  UNSUPPORTED_FORMAT:
    "This file type is not supported. Upload a CSV, XLS, XLSX, or XLSM file.",
  PASSWORD_PROTECTED:
    "This workbook is password-protected. Remove workbook encryption before importing.",
  CORRUPT_OR_UNREADABLE:
    "This file appears damaged or is not a readable Excel/CSV document.",
  FILE_TOO_LARGE: "File is too large. Maximum upload size is 4 MB.",
  TOO_MANY_SHEETS: "This workbook contains too many visible worksheets.",
  TOO_MANY_COLUMNS: "This worksheet contains too many columns.",
  TOO_MANY_ROWS: "This worksheet contains too many rows.",
  PARSE_ERROR: "We couldn't read this file. Check its format and try again.",
};

export function importFileFailure(
  errorCode: ImportFileErrorCode,
  error?: string
): ImportFileFailure {
  return {
    error:
      error ??
      (errorCode === "CONTENT_TYPE_MISMATCH"
        ? "The file contents do not match its filename extension."
        : STATIC_ERROR_MESSAGES[errorCode]),
    errorCode,
  };
}

export function contentMismatchFailure(extension: string): ImportFileFailure {
  return importFileFailure(
    "CONTENT_TYPE_MISMATCH",
    `The file contents do not match the ${extension || "provided"} extension.`
  );
}

export function normalizedImportExtension(
  fileName: string
): ImportFileFormat | null {
  const match = /\.([^.]+)$/u.exec(fileName.trim().toLowerCase());
  if (!match) return null;
  const extension = match[1];
  return (SUPPORTED_IMPORT_FILE_FORMATS as readonly string[]).includes(
    extension
  )
    ? (extension as ImportFileFormat)
    : null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

const CFB_FREE_SECTOR = 0xffffffff;
const CFB_END_OF_CHAIN = 0xfffffffe;
const CFB_FAT_SECTOR = 0xfffffffd;
const CFB_DIFAT_SECTOR = 0xfffffffc;

function oleStreamNames(bytes: Uint8Array): Set<string> | null {
  if (bytes.byteLength < 512 || !startsWith(bytes, OLE_SIGNATURE)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readUint16 = (offset: number): number | null =>
    offset >= 0 && offset + 2 <= view.byteLength
      ? view.getUint16(offset, true)
      : null;
  const readUint32 = (offset: number): number | null =>
    offset >= 0 && offset + 4 <= view.byteLength
      ? view.getUint32(offset, true)
      : null;

  if (readUint16(28) !== 0xfffe) return null;
  const sectorShift = readUint16(30);
  if (sectorShift !== 9 && sectorShift !== 12) return null;
  const sectorSize = 2 ** sectorShift;
  const sectorCount = Math.floor(bytes.byteLength / sectorSize) - 1;
  if (sectorCount <= 0) return null;

  const sectorOffset = (sectorId: number): number | null => {
    if (!Number.isInteger(sectorId) || sectorId < 0 || sectorId >= sectorCount) {
      return null;
    }
    const offset = (sectorId + 1) * sectorSize;
    return offset + sectorSize <= bytes.byteLength ? offset : null;
  };

  const fatSectorCount = readUint32(44);
  const firstDirectorySector = readUint32(48);
  const firstDifatSector = readUint32(68);
  const difatSectorCount = readUint32(72);
  if (
    fatSectorCount === null ||
    firstDirectorySector === null ||
    firstDifatSector === null ||
    difatSectorCount === null ||
    fatSectorCount > sectorCount ||
    difatSectorCount > sectorCount
  ) {
    return null;
  }

  const fatSectorIds: number[] = [];
  for (let index = 0; index < 109 && fatSectorIds.length < fatSectorCount; index += 1) {
    const sectorId = readUint32(76 + index * 4);
    if (sectorId === null) return null;
    if (sectorId !== CFB_FREE_SECTOR) fatSectorIds.push(sectorId);
  }

  const seenDifatSectors = new Set<number>();
  let difatSectorId = firstDifatSector;
  const difatEntriesPerSector = sectorSize / 4 - 1;
  for (
    let sectorIndex = 0;
    sectorIndex < difatSectorCount && fatSectorIds.length < fatSectorCount;
    sectorIndex += 1
  ) {
    if (
      difatSectorId === CFB_END_OF_CHAIN ||
      seenDifatSectors.has(difatSectorId)
    ) {
      return null;
    }
    const offset = sectorOffset(difatSectorId);
    if (offset === null) return null;
    seenDifatSectors.add(difatSectorId);

    for (
      let index = 0;
      index < difatEntriesPerSector && fatSectorIds.length < fatSectorCount;
      index += 1
    ) {
      const sectorId = readUint32(offset + index * 4);
      if (sectorId === null) return null;
      if (sectorId !== CFB_FREE_SECTOR) fatSectorIds.push(sectorId);
    }
    const next = readUint32(offset + difatEntriesPerSector * 4);
    if (next === null) return null;
    difatSectorId = next;
  }

  if (fatSectorIds.length !== fatSectorCount) return null;
  const fat: number[] = [];
  for (const fatSectorId of fatSectorIds) {
    if (
      fatSectorId === CFB_FAT_SECTOR ||
      fatSectorId === CFB_DIFAT_SECTOR
    ) {
      return null;
    }
    const offset = sectorOffset(fatSectorId);
    if (offset === null) return null;
    for (let index = 0; index < sectorSize / 4; index += 1) {
      const entry = readUint32(offset + index * 4);
      if (entry === null) return null;
      fat.push(entry);
    }
  }

  const streamNames = new Set<string>();
  const seenDirectorySectors = new Set<number>();
  let directorySectorId = firstDirectorySector;
  while (directorySectorId !== CFB_END_OF_CHAIN) {
    if (
      directorySectorId >= fat.length ||
      seenDirectorySectors.has(directorySectorId)
    ) {
      return null;
    }
    const offset = sectorOffset(directorySectorId);
    if (offset === null) return null;
    seenDirectorySectors.add(directorySectorId);

    for (let entryOffset = offset; entryOffset < offset + sectorSize; entryOffset += 128) {
      const nameLength = readUint16(entryOffset + 64);
      if (nameLength === null || nameLength === 0) continue;
      const objectType = bytes[entryOffset + 66];
      if (
        objectType !== 2 ||
        nameLength < 2 ||
        nameLength > 64 ||
        nameLength % 2 !== 0
      ) {
        continue;
      }

      let name = "";
      for (let index = 0; index < nameLength - 2; index += 2) {
        const codeUnit = readUint16(entryOffset + index);
        if (codeUnit === null) return null;
        name += String.fromCharCode(codeUnit);
      }
      streamNames.add(name.toLowerCase());
    }

    const nextSector = fat[directorySectorId];
    if (
      nextSector === CFB_FREE_SECTOR ||
      nextSector === CFB_FAT_SECTOR ||
      nextSector === CFB_DIFAT_SECTOR
    ) {
      return null;
    }
    directorySectorId = nextSector;
  }

  return streamNames;
}

function hasEncryptedOoxmlStreams(bytes: Uint8Array): boolean {
  const streamNames = oleStreamNames(bytes);
  return (
    streamNames?.has("encryptioninfo") === true &&
    streamNames.has("encryptedpackage")
  );
}

function looksLikeUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.some((value) => value === 0)) return false;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  if (!text.trim()) return false;

  let disallowedControls = 0;
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      disallowedControls += 1;
    }
  }
  return disallowedControls / Math.max(text.length, 1) <= 0.02;
}

function startsWithBiffWorkbookRecord(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x09) return false;
  if (![0x00, 0x02, 0x04, 0x08].includes(bytes[1])) return false;
  const recordLength = bytes[2] | (bytes[3] << 8);
  return recordLength > 0 && recordLength <= bytes.length - 4;
}

export function detectImportFileContent(
  bytes: Uint8Array
): ImportFileContentKind | "empty" {
  if (bytes.byteLength === 0) return "empty";
  if (ZIP_SIGNATURES.some((signature) => startsWith(bytes, signature))) {
    return "ooxml";
  }
  if (startsWith(bytes, OLE_SIGNATURE)) return "ole";
  if (startsWithBiffWorkbookRecord(bytes)) return "biff";
  return looksLikeUtf8Text(bytes) ? "text" : "binary";
}

export function detectImportFile(
  fileName: string,
  bytes: Uint8Array
): DetectedImportFile | ImportFileFailure {
  if (bytes.byteLength > MAX_IMPORT_FILE_BYTES) {
    return importFileFailure("FILE_TOO_LARGE");
  }

  const contentKind = detectImportFileContent(bytes);
  if (contentKind === "empty") return importFileFailure("EMPTY_FILE");

  const format = normalizedImportExtension(fileName);
  if (!format) return importFileFailure("UNSUPPORTED_FORMAT");

  if (
    contentKind === "ole" &&
    (format === "xlsx" || format === "xlsm") &&
    hasEncryptedOoxmlStreams(bytes)
  ) {
    return importFileFailure("PASSWORD_PROTECTED");
  }

  const contentMatches =
    (format === "csv" && contentKind === "text") ||
    (format === "xls" && (contentKind === "ole" || contentKind === "biff")) ||
    ((format === "xlsx" || format === "xlsm") && contentKind === "ooxml");
  if (!contentMatches) {
    return contentKind === "binary"
      ? importFileFailure("UNSUPPORTED_FORMAT")
      : contentMismatchFailure(`.${format}`);
  }

  return { format, contentKind };
}

export function isImportFileFailure(
  value: DetectedImportFile | ImportFileFailure
): value is ImportFileFailure {
  return "error" in value;
}

export function isPasswordProtectedParserError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("password-protected") ||
    message.includes("password protected") ||
    message.includes("unsupported encryption") ||
    message.includes("encrypted package")
  );
}
