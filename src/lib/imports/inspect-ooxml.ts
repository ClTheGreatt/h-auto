import { inflateRawSync } from "node:zlib";
import {
  importFileFailure,
  type ImportFileFailure,
} from "./file-format";

export type OoxmlWorkbookKind = "xlsx" | "xlsm";

type ZipEntry = {
  name: string;
  flags: number;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_CONTENT_TYPES_BYTES = 1024 * 1024;
const MAX_ZIP_ENTRIES = 10_000;
const XLSX_WORKBOOK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const XLSM_WORKBOOK_CONTENT_TYPE =
  "application/vnd.ms-excel.sheet.macroenabled.main+xml";

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  return -1;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0 || eocdOffset + 22 > buffer.length) {
    throw new Error("Invalid ZIP directory");
  }

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    entryCount > MAX_ZIP_ENTRIES ||
    centralDirectoryOffset + centralDirectorySize > buffer.length
  ) {
    throw new Error("Unsupported ZIP directory");
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY
    ) {
      throw new Error("Invalid ZIP entry");
    }
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset =
      offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > buffer.length) throw new Error("Invalid ZIP entry bounds");

    entries.push({
      name: buffer
        .subarray(offset + 46, offset + 46 + fileNameLength)
        .toString("utf8")
        .replace(/\\/gu, "/"),
      flags: buffer.readUInt16LE(offset + 8),
      compression: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });
    offset = nextOffset;
  }
  return entries;
}

function extractEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  if ((entry.flags & 0x1) !== 0) {
    throw new Error("Encrypted ZIP entry");
  }
  if (
    entry.uncompressedSize > MAX_CONTENT_TYPES_BYTES ||
    entry.localHeaderOffset + 30 > buffer.length ||
    buffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_HEADER
  ) {
    throw new Error("Invalid OOXML manifest");
  }

  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataOffset =
    entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > buffer.length) throw new Error("Invalid OOXML manifest bounds");
  const compressed = buffer.subarray(dataOffset, dataEnd);

  if (entry.compression === 0) return Buffer.from(compressed);
  if (entry.compression === 8) {
    return inflateRawSync(compressed, {
      maxOutputLength: MAX_CONTENT_TYPES_BYTES,
    });
  }
  throw new Error("Unsupported OOXML manifest compression");
}

function decodeXmlAttribute(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|apos|gt|lt|quot));/giu,
    (entity, decimal: string, hexadecimal: string, named: string) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      switch (named.toLowerCase()) {
        case "amp":
          return "&";
        case "apos":
          return "'";
        case "gt":
          return ">";
        case "lt":
          return "<";
        case "quot":
          return '"';
        default:
          return entity;
      }
    }
  );
}

function findXmlTagEnd(xml: string, start: number): number {
  let quote = "";
  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function findXmlDeclarationEnd(xml: string, start: number): number {
  let quote = "";
  let bracketDepth = 0;
  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
    } else if (character === ">" && bracketDepth === 0) {
      return index;
    }
  }
  return -1;
}

function parseXmlStartTag(
  source: string
): { localName: string; attributes: Map<string, string> } | null {
  let index = 0;
  const skipWhitespace = () => {
    while (index < source.length && /\s/u.test(source[index])) index += 1;
  };

  skipWhitespace();
  const nameStart = index;
  while (index < source.length && !/[\s/>]/u.test(source[index])) index += 1;
  if (index === nameStart) return null;
  const elementName = source.slice(nameStart, index);
  const attributes = new Map<string, string>();

  while (index < source.length) {
    skipWhitespace();
    if (index >= source.length || source[index] === "/") break;
    const attributeStart = index;
    while (index < source.length && !/[\s=/>]/u.test(source[index])) index += 1;
    if (index === attributeStart) return null;
    const attributeName = source.slice(attributeStart, index);
    skipWhitespace();
    if (source[index] !== "=") return null;
    index += 1;
    skipWhitespace();
    const quote = source[index];
    if (quote !== '"' && quote !== "'") return null;
    index += 1;
    const valueStart = index;
    while (index < source.length && source[index] !== quote) index += 1;
    if (index >= source.length) return null;
    if (attributes.has(attributeName)) return null;
    attributes.set(
      attributeName,
      decodeXmlAttribute(source.slice(valueStart, index))
    );
    index += 1;
  }

  return {
    localName: elementName.split(":").at(-1)!,
    attributes,
  };
}

function workbookContentTypeDeclarations(xml: string): string[] | null {
  const declarations: string[] = [];
  let index = 0;

  while (index < xml.length) {
    const start = xml.indexOf("<", index);
    if (start < 0) break;

    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      if (end < 0) return null;
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", start)) {
      const end = xml.indexOf("]]>", start + 9);
      if (end < 0) return null;
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<?", start)) {
      const end = xml.indexOf("?>", start + 2);
      if (end < 0) return null;
      index = end + 2;
      continue;
    }
    if (xml.startsWith("<!", start)) {
      const end = findXmlDeclarationEnd(xml, start + 2);
      if (end < 0) return null;
      index = end + 1;
      continue;
    }

    const end = findXmlTagEnd(xml, start + 1);
    if (end < 0) return null;
    const source = xml.slice(start + 1, end);
    index = end + 1;
    if (/^\s*\//u.test(source)) continue;

    const tag = parseXmlStartTag(source);
    if (!tag) return null;
    if (tag.localName !== "Override") continue;

    const partName = tag.attributes
      .get("PartName")
      ?.trim()
      .replace(/\\/gu, "/")
      .toLowerCase();
    if (partName !== "/xl/workbook.xml") continue;
    const contentType = tag.attributes.get("ContentType")?.trim().toLowerCase();
    if (!contentType) return null;
    declarations.push(contentType);
  }

  return declarations;
}

function classifyWorkbookContentType(
  manifest: string
): OoxmlWorkbookKind | "unsupported" | null {
  const declarations = workbookContentTypeDeclarations(manifest);
  if (!declarations || declarations.length !== 1) return null;
  if (declarations[0] === XLSX_WORKBOOK_CONTENT_TYPE) return "xlsx";
  if (declarations[0] === XLSM_WORKBOOK_CONTENT_TYPE) return "xlsm";
  return "unsupported";
}

export function inspectOoxmlWorkbookKind(
  arrayBuffer: ArrayBuffer
): OoxmlWorkbookKind | ImportFileFailure {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const entries = readZipEntries(buffer);
    const names = new Set(entries.map((entry) => entry.name.toLowerCase()));
    if (!names.has("xl/workbook.xml")) {
      return importFileFailure("UNSUPPORTED_FORMAT");
    }

    const contentTypes = entries.find(
      (entry) => entry.name.toLowerCase() === "[content_types].xml"
    );
    if (!contentTypes) return importFileFailure("CORRUPT_OR_UNREADABLE");
    if ((contentTypes.flags & 0x1) !== 0) {
      return importFileFailure("PASSWORD_PROTECTED");
    }

    const manifest = extractEntry(buffer, contentTypes).toString("utf8");
    const workbookKind = classifyWorkbookContentType(manifest);
    if (workbookKind === null) {
      return importFileFailure("CORRUPT_OR_UNREADABLE");
    }
    return workbookKind === "unsupported"
      ? importFileFailure("UNSUPPORTED_FORMAT")
      : workbookKind;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Encrypted ZIP entry"
    ) {
      return importFileFailure("PASSWORD_PROTECTED");
    }
    return importFileFailure("CORRUPT_OR_UNREADABLE");
  }
}
