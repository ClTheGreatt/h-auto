import { inflateRawSync } from "node:zlib";
import {
  importFileFailure,
  type ImportFileFailure,
} from "./file-format";

export type OoxmlWorkbookKind = "xlsx" | "xlsm";
export type OoxmlWorkbookClassification =
  | "CANONICAL_XLSX"
  | "COMPATIBLE_XLSX"
  | "CANONICAL_XLSM";

export type OoxmlWorkbookInspection = {
  kind: OoxmlWorkbookKind;
  classification: OoxmlWorkbookClassification;
};

type ZipEntry = {
  name: string;
  flags: number;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type XmlAttribute = {
  localName: string;
  namespaceUri: string;
  value: string;
};

type XmlElement = {
  localName: string;
  namespaceUri: string;
  depth: number;
  parentLocalName: string | null;
  parentNamespaceUri: string | null;
  attributes: XmlAttribute[];
};

type XmlDocument = {
  root: XmlElement;
  elements: XmlElement[];
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
const CONTENT_TYPES_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/content-types";
const PACKAGE_RELATIONSHIPS_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const WORKSHEET_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
const OFFICE_DOCUMENT_RELATIONSHIPS_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const SPREADSHEETML_NAMESPACE =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const VBA_PROJECT_CONTENT_TYPE = "application/vnd.ms-office.vbaproject";

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
        .toString("utf8"),
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

function isValidXmlCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function hasOnlyValidXmlCharacters(value: string): boolean {
  return Array.from(value).every((character) =>
    isValidXmlCodePoint(character.codePointAt(0)!)
  );
}

function hasOnlyValidXmlEntities(value: string): boolean {
  for (
    let index = value.indexOf("&");
    index >= 0;
    index = value.indexOf("&", index + 1)
  ) {
    const end = value.indexOf(";", index + 1);
    if (end < 0) return false;
    const entity = value.slice(index + 1, end);
    if (!/^(?:amp|apos|gt|lt|quot|#\d+|#x[\da-fA-F]+)$/u.test(entity)) {
      return false;
    }
    if (entity.startsWith("#")) {
      const codePoint = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!isValidXmlCodePoint(codePoint)) return false;
    }
    index = end;
  }
  return true;
}

const XML_NAME = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/u;

function parseStrictXmlStartTag(
  source: string
): { name: string; attributes: Map<string, string>; selfClosing: boolean } | null {
  let content = source.trim();
  const selfClosing = content.endsWith("/");
  if (selfClosing) content = content.slice(0, -1).trimEnd();

  let index = 0;
  while (index < content.length && !/\s/u.test(content[index])) index += 1;
  const name = content.slice(0, index);
  if (!XML_NAME.test(name)) return null;

  const attributes = new Map<string, string>();
  while (index < content.length) {
    while (index < content.length && /\s/u.test(content[index])) index += 1;
    if (index >= content.length) break;

    const start = index;
    while (index < content.length && !/[\s=]/u.test(content[index])) index += 1;
    const attributeName = content.slice(start, index);
    if (!XML_NAME.test(attributeName) || attributes.has(attributeName)) return null;
    while (index < content.length && /\s/u.test(content[index])) index += 1;
    if (content[index] !== "=") return null;
    index += 1;
    while (index < content.length && /\s/u.test(content[index])) index += 1;
    const quote = content[index];
    if (quote !== '"' && quote !== "'") return null;
    index += 1;
    const valueStart = index;
    while (index < content.length && content[index] !== quote) index += 1;
    if (index >= content.length) return null;
    const rawValue = content.slice(valueStart, index);
    if (rawValue.includes("<") || !hasOnlyValidXmlEntities(rawValue)) return null;
    attributes.set(attributeName, decodeXmlAttribute(rawValue));
    index += 1;
    if (index < content.length && !/\s/u.test(content[index])) return null;
  }

  return { name, attributes, selfClosing };
}

function namespaceParts(name: string): { prefix: string; localName: string } {
  const separator = name.indexOf(":");
  return separator < 0
    ? { prefix: "", localName: name }
    : { prefix: name.slice(0, separator), localName: name.slice(separator + 1) };
}

function parseXmlDocument(xml: string): XmlDocument | null {
  if (!hasOnlyValidXmlCharacters(xml)) return null;
  const elements: XmlElement[] = [];
  const elementStack: Array<{
    name: string;
    localName: string;
    namespaceUri: string;
    namespaces: Map<string, string>;
  }> = [];
  let root: XmlElement | null = null;
  let rootClosed = false;
  let index = xml.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (index < xml.length) {
    const start = xml.indexOf("<", index);
    const text = start < 0 ? xml.slice(index) : xml.slice(index, start);
    if ((!elementStack.length && text.trim()) || !hasOnlyValidXmlEntities(text)) {
      return null;
    }
    if (start < 0) break;

    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      if (end < 0 || xml.slice(start + 4, end).includes("--")) return null;
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", start)) {
      if (!elementStack.length) return null;
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
      // OOXML parts do not need DTDs. Rejecting them also avoids entity expansion.
      return null;
    }

    const end = findXmlTagEnd(xml, start + 1);
    if (end < 0) return null;
    const source = xml.slice(start + 1, end);
    index = end + 1;

    if (/^\s*\//u.test(source)) {
      const name = source.replace(/^\s*\/\s*/u, "").trim();
      if (!XML_NAME.test(name) || elementStack.at(-1)?.name !== name) return null;
      elementStack.pop();
      if (!elementStack.length) rootClosed = true;
      continue;
    }

    if (rootClosed) return null;
    const parsed = parseStrictXmlStartTag(source);
    if (!parsed) return null;
    const namespaces = new Map(elementStack.at(-1)?.namespaces ?? [["xml", "http://www.w3.org/XML/1998/namespace"]]);
    for (const [name, value] of parsed.attributes) {
      if (name === "xmlns") {
        if (value === "http://www.w3.org/2000/xmlns/") return null;
        namespaces.set("", value);
      } else if (name.startsWith("xmlns:")) {
        const prefix = name.slice(6);
        if (
          !value ||
          prefix === "xmlns" ||
          (prefix === "xml" && value !== "http://www.w3.org/XML/1998/namespace") ||
          (prefix !== "xml" && value === "http://www.w3.org/XML/1998/namespace") ||
          value === "http://www.w3.org/2000/xmlns/"
        ) {
          return null;
        }
        namespaces.set(prefix, value);
      }
    }

    const nameParts = namespaceParts(parsed.name);
    const namespaceUri = namespaces.get(nameParts.prefix);
    if (nameParts.prefix && !namespaceUri) return null;

    const attributes: XmlAttribute[] = [];
    const expandedAttributeNames = new Set<string>();
    for (const [name, value] of parsed.attributes) {
      if (name === "xmlns" || name.startsWith("xmlns:")) continue;
      const parts = namespaceParts(name);
      const attributeNamespace = parts.prefix ? namespaces.get(parts.prefix) : "";
      if (parts.prefix && !attributeNamespace) return null;
      const expandedName = `${attributeNamespace ?? ""}\0${parts.localName}`;
      if (expandedAttributeNames.has(expandedName)) return null;
      expandedAttributeNames.add(expandedName);
      attributes.push({
        localName: parts.localName,
        namespaceUri: attributeNamespace ?? "",
        value,
      });
    }

    const element: XmlElement = {
      localName: nameParts.localName,
      namespaceUri: namespaceUri ?? "",
      depth: elementStack.length,
      parentLocalName: elementStack.at(-1)?.localName ?? null,
      parentNamespaceUri: elementStack.at(-1)?.namespaceUri ?? null,
      attributes,
    };
    if (!root) root = element;
    elements.push(element);
    if (!parsed.selfClosing) {
      elementStack.push({
        name: parsed.name,
        localName: nameParts.localName,
        namespaceUri: namespaceUri ?? "",
        namespaces,
      });
    } else if (!elementStack.length) {
      rootClosed = true;
    }
  }

  return root && rootClosed && elementStack.length === 0
    ? { root, elements }
    : null;
}

function xmlAttribute(
  element: XmlElement,
  localName: string,
  namespaceUri = ""
): string | undefined {
  return element.attributes.find(
    (attribute) =>
      attribute.localName === localName && attribute.namespaceUri === namespaceUri
  )?.value;
}

function decodeXmlEntry(buffer: Buffer, entry: ZipEntry): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(extractEntry(buffer, entry));
}

function safeEntryMap(entries: ZipEntry[]): Map<string, ZipEntry> | null {
  const result = new Map<string, ZipEntry>();
  for (const entry of entries) {
    if (
      entry.name.includes("\\") ||
      entry.name.startsWith("/") ||
      entry.name.includes("\0")
    ) {
      return null;
    }
    const segments = entry.name.split("/");
    if (segments.some((segment) => segment === "." || segment === "..")) return null;
    const normalized = entry.name.toLowerCase();
    if (result.has(normalized)) return null;
    result.set(normalized, entry);
  }
  return result;
}

function resolvePackageTarget(sourcePart: string, rawTarget: string): string | null {
  const target = rawTarget.trim();
  if (
    !target ||
    target.includes("\\") ||
    target.includes("?") ||
    target.includes("#") ||
    target.startsWith("//") ||
    /^[A-Za-z][A-Za-z\d+.-]*:/u.test(target)
  ) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  const targetSegments = decoded.replace(/^\//u, "").split("/");
  if (targetSegments.some((segment) => !segment || segment === ".." || segment === ".")) {
    return null;
  }
  const base = target.startsWith("/")
    ? []
    : sourcePart.split("/").slice(0, -1).filter(Boolean);
  return [...base, ...targetSegments].join("/").toLowerCase();
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

function workbookContentTypeDeclarations(xml: string): string[] | null {
  const document = parseXmlDocument(xml);
  if (
    !document ||
    document.root.localName !== "Types" ||
    document.root.namespaceUri !== CONTENT_TYPES_NAMESPACE
  ) {
    return null;
  }

  const declarations: string[] = [];
  for (const element of document.elements) {
    if (
      element.depth !== 1 ||
      element.localName !== "Override" ||
      element.namespaceUri !== CONTENT_TYPES_NAMESPACE
    ) {
      continue;
    }
    const partName = xmlAttribute(element, "PartName")
      ?.trim()
      .replace(/\\/gu, "/")
      .toLowerCase();
    if (partName !== "/xl/workbook.xml") continue;
    const contentType = xmlAttribute(element, "ContentType")
      ?.trim()
      .toLowerCase();
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

function relationshipElements(document: XmlDocument): XmlElement[] | null {
  if (
    document.root.localName !== "Relationships" ||
    document.root.namespaceUri !== PACKAGE_RELATIONSHIPS_NAMESPACE
  ) {
    return null;
  }
  const relationships = document.elements.filter(
    (element) =>
      element.depth === 1 &&
      element.localName === "Relationship" &&
      element.namespaceUri === PACKAGE_RELATIONSHIPS_NAMESPACE
  );
  const ids = relationships.map((relationship) => xmlAttribute(relationship, "Id"));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return null;
  return relationships;
}

function hasMacroEvidence(
  entries: Map<string, ZipEntry>,
  contentTypes: XmlDocument
): boolean {
  if (entries.has("xl/vbaproject.bin")) return true;
  return contentTypes.elements.some((element) => {
    if (
      element.namespaceUri !== CONTENT_TYPES_NAMESPACE ||
      (element.localName !== "Default" && element.localName !== "Override")
    ) {
      return false;
    }
    const contentType = xmlAttribute(element, "ContentType")?.trim().toLowerCase();
    return (
      contentType === XLSM_WORKBOOK_CONTENT_TYPE ||
      contentType === VBA_PROJECT_CONTENT_TYPE
    );
  });
}

function isCompatibleXlsxPackage(
  buffer: Buffer,
  entries: ZipEntry[],
  manifest: string
): boolean {
  if (entries.some((entry) => (entry.flags & 0x1) !== 0)) {
    throw new Error("Encrypted ZIP entry");
  }
  const entryMap = safeEntryMap(entries);
  if (!entryMap) return false;

  const contentTypes = parseXmlDocument(manifest);
  if (
    !contentTypes ||
    contentTypes.root.localName !== "Types" ||
    contentTypes.root.namespaceUri !== CONTENT_TYPES_NAMESPACE ||
    hasMacroEvidence(entryMap, contentTypes)
  ) {
    return false;
  }

  const rootRelationshipsEntry = entryMap.get("_rels/.rels");
  const workbookEntry = entryMap.get("xl/workbook.xml");
  const workbookRelationshipsEntry = entryMap.get("xl/_rels/workbook.xml.rels");
  if (!rootRelationshipsEntry || !workbookEntry || !workbookRelationshipsEntry) {
    return false;
  }

  const rootRelationshipsDocument = parseXmlDocument(
    decodeXmlEntry(buffer, rootRelationshipsEntry)
  );
  if (!rootRelationshipsDocument) return false;
  const rootRelationships = relationshipElements(rootRelationshipsDocument);
  if (!rootRelationships) return false;
  const officeDocumentRelationships = rootRelationships.filter(
    (relationship) =>
      xmlAttribute(relationship, "Type") === OFFICE_DOCUMENT_RELATIONSHIP
  );
  if (officeDocumentRelationships.length !== 1) return false;
  const officeDocumentRelationship = officeDocumentRelationships[0];
  if (
    xmlAttribute(officeDocumentRelationship, "TargetMode")
      ?.trim()
      .toLowerCase() === "external"
  ) {
    return false;
  }
  const workbookTarget = xmlAttribute(officeDocumentRelationship, "Target");
  if (
    !workbookTarget ||
    resolvePackageTarget("", workbookTarget) !== "xl/workbook.xml"
  ) {
    return false;
  }

  const workbook = parseXmlDocument(decodeXmlEntry(buffer, workbookEntry));
  if (
    !workbook ||
    workbook.root.localName !== "workbook" ||
    workbook.root.namespaceUri !== SPREADSHEETML_NAMESPACE
  ) {
    return false;
  }

  const referencedWorksheetRelationshipIds = new Set(
    workbook.elements
      .filter(
        (element) =>
          element.depth === 2 &&
          element.localName === "sheet" &&
          element.namespaceUri === SPREADSHEETML_NAMESPACE &&
          element.parentLocalName === "sheets" &&
          element.parentNamespaceUri === SPREADSHEETML_NAMESPACE
      )
      .map((element) =>
        xmlAttribute(element, "id", OFFICE_DOCUMENT_RELATIONSHIPS_NAMESPACE)
      )
      .filter((id): id is string => Boolean(id))
  );
  if (referencedWorksheetRelationshipIds.size === 0) return false;

  const workbookRelationshipsDocument = parseXmlDocument(
    decodeXmlEntry(buffer, workbookRelationshipsEntry)
  );
  if (!workbookRelationshipsDocument) return false;
  const workbookRelationships = relationshipElements(workbookRelationshipsDocument);
  if (!workbookRelationships) return false;
  const worksheetRelationships = workbookRelationships.filter(
    (relationship) => xmlAttribute(relationship, "Type") === WORKSHEET_RELATIONSHIP
  );
  if (worksheetRelationships.length === 0) return false;

  let referencedValidWorksheetCount = 0;
  for (const worksheetRelationship of worksheetRelationships) {
    if (
      xmlAttribute(worksheetRelationship, "TargetMode")
        ?.trim()
        .toLowerCase() === "external"
    ) {
      return false;
    }
    const id = xmlAttribute(worksheetRelationship, "Id");
    const target = xmlAttribute(worksheetRelationship, "Target");
    const resolvedTarget = target
      ? resolvePackageTarget("xl/workbook.xml", target)
      : null;
    if (
      !id ||
      !resolvedTarget ||
      !resolvedTarget.startsWith("xl/worksheets/") ||
      !resolvedTarget.endsWith(".xml")
    ) {
      return false;
    }
    const worksheetEntry = entryMap.get(resolvedTarget);
    if (!worksheetEntry) return false;
    const worksheet = parseXmlDocument(decodeXmlEntry(buffer, worksheetEntry));
    if (
      !worksheet ||
      worksheet.root.localName !== "worksheet" ||
      worksheet.root.namespaceUri !== SPREADSHEETML_NAMESPACE
    ) {
      return false;
    }
    if (referencedWorksheetRelationshipIds.has(id)) {
      referencedValidWorksheetCount += 1;
    }
  }

  return referencedValidWorksheetCount > 0;
}

export function inspectOoxmlWorkbook(
  arrayBuffer: ArrayBuffer,
  expectedKind?: OoxmlWorkbookKind
): OoxmlWorkbookInspection | ImportFileFailure {
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
    const declarations = workbookContentTypeDeclarations(manifest);
    if (!declarations || declarations.length > 1) {
      return importFileFailure("CORRUPT_OR_UNREADABLE");
    }
    if (declarations.length === 1) {
      const workbookKind = classifyWorkbookContentType(manifest);
      if (workbookKind === "unsupported") {
        return importFileFailure("UNSUPPORTED_FORMAT");
      }
      if (!workbookKind) return importFileFailure("CORRUPT_OR_UNREADABLE");
      return {
        kind: workbookKind,
        classification:
          workbookKind === "xlsx" ? "CANONICAL_XLSX" : "CANONICAL_XLSM",
      };
    }

    // Compatibility is intentionally extension-bound and missing-declaration
    // only. Explicit, duplicate, macro-enabled, or unknown declarations never
    // reach this structural fallback.
    if (
      expectedKind === "xlsx" &&
      isCompatibleXlsxPackage(buffer, entries, manifest)
    ) {
      return { kind: "xlsx", classification: "COMPATIBLE_XLSX" };
    }
    return importFileFailure("CORRUPT_OR_UNREADABLE");
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

export function inspectOoxmlWorkbookKind(
  arrayBuffer: ArrayBuffer,
  expectedKind?: OoxmlWorkbookKind
): OoxmlWorkbookKind | ImportFileFailure {
  const inspection = inspectOoxmlWorkbook(arrayBuffer, expectedKind);
  return "kind" in inspection ? inspection.kind : inspection;
}
