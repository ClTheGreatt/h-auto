import {
  FACULTY_IMPORT_COLUMNS,
  FACULTY_REQUIRED_FIELDS,
  STUDENT_IMPORT_COLUMNS,
  STUDENT_REQUIRED_FIELDS,
  type ImportRowType,
} from "@/lib/constants/user-import";
import type { ImportFileFormat } from "./file-format";
import {
  classifyImportDocument,
  type DocumentIntelligence,
} from "./document-structure";
import {
  extractDocumentMetadata,
  uniqueSafeMetadataByField,
  type DocumentMetadata,
} from "./metadata-extractor";
import {
  classifyImportRows,
  parseReviewedFullName,
  type FullNameSuggestion,
  type RowClassification,
} from "./row-classifier";

export const MAX_IMPORT_WORKSHEETS = 10;
export const MAX_HEADER_SCAN_ROWS = 50;
export const MAX_IMPORT_COLUMNS = 100;
export const MAX_IMPORT_DATA_ROWS = 250;

export type FacultyImportField = (typeof FACULTY_IMPORT_COLUMNS)[number];
export type StudentImportField = (typeof STUDENT_IMPORT_COLUMNS)[number];
export type ImportField = FacultyImportField | StudentImportField;

export type ImportColumnStatus =
  | "AUTO_MAPPED"
  | "MANUAL_MAPPED"
  | "UNMAPPED"
  | "IGNORED"
  | "AMBIGUOUS";

export type ImportMappingStatus = "READY" | "NEEDS_MAPPING" | "AMBIGUOUS";

export type ImportCell = {
  text: string;
  isFormula?: boolean;
  isError?: boolean;
};

export type AnalysisGenerationTracker = {
  current: number;
};

export type ImportMatrixRow = {
  rowNumber: number;
  cells: ImportCell[];
};

export type ImportColumn = {
  sourceIndex: number;
  sourceHeader: string;
  normalizedHeader: string;
  suggestedField: ImportField | null;
  mappedField: ImportField | null;
  confidence: "exact-alias" | "none";
  status: ImportColumnStatus;
  issue?: string;
};

export type ImportColumnMapping = Pick<
  ImportColumn,
  "sourceIndex" | "sourceHeader" | "mappedField" | "status"
>;

export type DetectedHeader = {
  rowNumber: number;
  preview: string;
  recognizedFields: ImportField[];
  score: number;
  identityFieldCount: number;
  roleSpecificFieldCount: number;
  qualifies: boolean;
  isStructuralHeader: boolean;
  mappedFieldEvidence: string[];
  documentEvidence: string[];
  negativeEvidence: string[];
  followingRecordCount: number;
  mostlyNumericFollowingCount: number;
  duplicateHeaders: string[];
};

export type ImportSheetCandidate = {
  name: string;
  headerCandidates: DetectedHeader[];
  selectedHeaderRow: number | null;
  hasQualifiedCandidate: boolean;
};

export type ImportSourceRow = {
  rowNumber: number;
  cells: ImportCell[];
};

export type ImportFieldSource =
  | {
      kind: "DOCUMENT_METADATA";
      value: string;
      metadataId: string;
    }
  | {
      kind: "REVIEWED_CONSTANT";
      value: string;
    };

export type FullNameRowSuggestion = FullNameSuggestion & { rowNumber: number };

export type MappingResult = {
  status: ImportMappingStatus;
  missingRequiredFields: ImportField[];
  errors: string[];
};

export type ImportMatrixAnalysis = {
  fileType: ImportFileFormat;
  sheetName: string;
  headerCandidates: DetectedHeader[];
  selectedHeaderRow: number | null;
  columns: ImportColumn[];
  sourceRows: ImportSourceRow[];
  rowClassifications: RowClassification[];
  skippedRowCount: number;
  metadata: DocumentMetadata[];
  document: DocumentIntelligence;
  fieldSources: Partial<Record<ImportField, ImportFieldSource>>;
  reviewedFullNameSourceIndex: number | null;
  fullNameSuggestions: FullNameRowSuggestion[];
  mappingStatus: ImportMappingStatus;
  missingRequiredFields: ImportField[];
  hasLegacyPasswordColumn: boolean;
};

export type MappedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  parsingErrors: string[];
};

export type AnalyzeMatrixResult =
  | { analysis: ImportMatrixAnalysis }
  | { error: string };

export function advanceAnalysisGeneration(
  tracker: AnalysisGenerationTracker
): number {
  tracker.current += 1;
  return tracker.current;
}

export function isCurrentAnalysisGeneration(
  tracker: AnalysisGenerationTracker,
  generation: number
): boolean {
  return tracker.current === generation;
}

export function shouldAutoContinueToPreview(
  analysis: ImportMatrixAnalysis | null
): analysis is ImportMatrixAnalysis {
  return (
    analysis?.mappingStatus === "READY" && analysis.sourceRows.length > 0
  );
}

function userStatusForMapping(
  status: ImportMappingStatus
): DocumentIntelligence["status"] {
  if (status === "READY") return "READY";
  return status === "AMBIGUOUS"
    ? "NEEDS_REVIEW"
    : "MISSING_REQUIRED_INFORMATION";
}

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  firstName: "First Name",
  middleName: "Middle Name",
  lastName: "Last Name",
  email: "Email",
  phoneNumber: "Phone Number",
  idNumber: "ID Number",
  department: "Department",
  position: "Position",
  academicYear: "Academic Year",
  course: "Course / Program",
  yearLevel: "Year Level",
  section: "Section",
};

const COMMON_ALIASES = {
  firstName: ["firstName", "first name", "firstname", "given name"],
  middleName: ["middleName", "middle name", "middlename", "middle initial"],
  lastName: ["lastName", "last name", "lastname", "surname", "family name"],
  email: ["email", "email address", "e-mail"],
  phoneNumber: [
    "phoneNumber",
    "phone",
    "phone number",
    "contact number",
    "mobile number",
    "mobile no",
  ],
} as const;

const FACULTY_ALIASES: Partial<Record<FacultyImportField, readonly string[]>> = {
  ...COMMON_ALIASES,
  idNumber: [
    "idNumber",
    "id number",
    "id no",
    "employee id",
    "employee number",
    "employee no",
    "faculty id",
    "instructor id",
  ],
  department: ["department", "dept"],
  position: ["position", "faculty position", "designation"],
};

const STUDENT_ALIASES: Partial<Record<StudentImportField, readonly string[]>> = {
  ...COMMON_ALIASES,
  idNumber: [
    "idNumber",
    "id number",
    "id no",
    "student number",
    "student no",
    "student id",
    "school id",
    "learner id",
  ],
  academicYear: ["academicYear", "academic year"],
  course: ["course", "program", "degree program"],
  yearLevel: ["yearLevel", "year level"],
  section: ["section", "class section"],
};

const AMBIGUOUS_HEADERS = new Set([
  "name",
  "full name",
  "id",
  "year",
  "level",
  "school year",
  "ay",
  "a y",
  "program year",
  "student name",
  "faculty name",
  "instructor name",
]);

const FULL_NAME_HEADERS = new Set([
  "name",
  "full name",
  "student name",
  "faculty name",
  "instructor name",
  "students",
]);

const STRUCTURAL_HEADER_WEIGHTS: Record<string, number> = {
  students: 4,
  student: 3,
  "student name": 5,
  "full name": 4,
  "faculty name": 5,
  activity: 2,
  activities: 2,
  quiz: 2,
  quizzes: 2,
  total: 1,
  equiv: 2,
  equivalent: 2,
  attendance: 3,
  present: 2,
  absent: 2,
  remarks: 1,
};

const NEGATIVE_HEADER_WEIGHTS: Record<string, number> = {
  activity: 1,
  activities: 1,
  quiz: 1,
  quizzes: 1,
  total: 1,
  equiv: 1,
  equivalent: 1,
  semester: 2,
  instructor: 2,
  "course code": 2,
  "course title": 2,
  college: 2,
};

const CONSTANT_ALLOWED_FIELDS: Record<ImportRowType, ReadonlySet<ImportField>> = {
  FACULTY: new Set(["department", "position"]),
  STUDENT_FARMER: new Set(["course", "yearLevel", "section", "academicYear"]),
};

const IDENTITY_FIELDS = new Set<ImportField>([
  "firstName",
  "lastName",
  "email",
  "idNumber",
]);

const ROLE_SPECIFIC_FIELDS: Record<ImportRowType, ReadonlySet<ImportField>> = {
  FACULTY: new Set(["department", "position"]),
  STUDENT_FARMER: new Set(["course", "section"]),
};

export function normalizeImportHeader(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s*\*\s*$/u, "")
    .toLowerCase()
    .replace(/[_.\/-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function getImportFields(importType: ImportRowType): readonly ImportField[] {
  return importType === "FACULTY"
    ? FACULTY_IMPORT_COLUMNS
    : STUDENT_IMPORT_COLUMNS;
}

export function getRequiredImportFields(
  importType: ImportRowType
): readonly ImportField[] {
  return importType === "FACULTY"
    ? FACULTY_REQUIRED_FIELDS
    : STUDENT_REQUIRED_FIELDS;
}

function aliasesForType(
  importType: ImportRowType
): Partial<Record<ImportField, readonly string[]>> {
  return importType === "FACULTY" ? FACULTY_ALIASES : STUDENT_ALIASES;
}

export function findAliasCollisions(importType: ImportRowType): string[] {
  const owners = new Map<string, ImportField>();
  const collisions = new Set<string>();

  for (const [field, aliases] of Object.entries(aliasesForType(importType)) as [
    ImportField,
    readonly string[],
  ][]) {
    for (const alias of aliases) {
      const normalized = normalizeImportHeader(alias);
      const owner = owners.get(normalized);
      if (owner && owner !== field) collisions.add(normalized);
      else owners.set(normalized, field);
    }
  }

  return [...collisions].sort();
}

function buildAliasIndex(importType: ImportRowType): Map<string, ImportField> {
  const collisions = findAliasCollisions(importType);
  if (collisions.length > 0) {
    throw new Error(
      `Import header aliases collide for ${importType}: ${collisions.join(", ")}`
    );
  }

  const index = new Map<string, ImportField>();
  for (const [field, aliases] of Object.entries(aliasesForType(importType)) as [
    ImportField,
    readonly string[],
  ][]) {
    for (const alias of aliases) {
      index.set(normalizeImportHeader(alias), field);
    }
  }
  return index;
}

const ALIAS_INDEX: Record<ImportRowType, Map<string, ImportField>> = {
  FACULTY: buildAliasIndex("FACULTY"),
  STUDENT_FARMER: buildAliasIndex("STUDENT_FARMER"),
};

function duplicateNormalizedHeaders(headers: readonly string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const header of headers) {
    const normalized = normalizeImportHeader(header);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([header]) => header)
  );
}

export function buildAutomaticColumns(
  headers: readonly string[],
  importType: ImportRowType
): ImportColumn[] {
  const aliasIndex = ALIAS_INDEX[importType];
  const duplicateHeaders = duplicateNormalizedHeaders(headers);
  const provisional = headers.map<ImportColumn>((sourceHeader, sourceIndex) => {
    const normalizedHeader = normalizeImportHeader(sourceHeader);
    const suggestedField = aliasIndex.get(normalizedHeader) ?? null;

    if (!normalizedHeader) {
      return {
        sourceIndex,
        sourceHeader,
        normalizedHeader,
        suggestedField: null,
        mappedField: null,
        confidence: "none",
        status: "IGNORED",
      };
    }

    if (
      duplicateHeaders.has(normalizedHeader) &&
      (suggestedField !== null || AMBIGUOUS_HEADERS.has(normalizedHeader))
    ) {
      return {
        sourceIndex,
        sourceHeader,
        normalizedHeader,
        suggestedField,
        mappedField: null,
        confidence: suggestedField ? "exact-alias" : "none",
        status: "AMBIGUOUS",
        issue: `Duplicate header "${sourceHeader}" requires review.`,
      };
    }

    if (suggestedField) {
      return {
        sourceIndex,
        sourceHeader,
        normalizedHeader,
        suggestedField,
        mappedField: suggestedField,
        confidence: "exact-alias",
        status: "AUTO_MAPPED",
      };
    }

    if (AMBIGUOUS_HEADERS.has(normalizedHeader)) {
      return {
        sourceIndex,
        sourceHeader,
        normalizedHeader,
        suggestedField: null,
        mappedField: null,
        confidence: "none",
        status: "UNMAPPED",
        issue: `Header "${sourceHeader}" is ambiguous and was not mapped automatically.`,
      };
    }

    return {
      sourceIndex,
      sourceHeader,
      normalizedHeader,
      suggestedField: null,
      mappedField: null,
      confidence: "none",
      status: "IGNORED",
    };
  });

  const fieldCounts = new Map<ImportField, number>();
  for (const column of provisional) {
    if (column.mappedField) {
      fieldCounts.set(column.mappedField, (fieldCounts.get(column.mappedField) ?? 0) + 1);
    }
  }

  return provisional.map((column) => {
    if (!column.mappedField || (fieldCounts.get(column.mappedField) ?? 0) === 1) {
      return column;
    }
    return {
      ...column,
      mappedField: null,
      status: "AMBIGUOUS" as const,
      issue: `${IMPORT_FIELD_LABELS[column.suggestedField!]} is suggested by more than one source column.`,
    };
  });
}

export function evaluateColumnMapping(
  columns: readonly ImportColumn[],
  importType: ImportRowType
): MappingResult {
  const errors: string[] = [];
  const targetCounts = new Map<ImportField, number>();
  for (const column of columns) {
    if (column.mappedField) {
      targetCounts.set(
        column.mappedField,
        (targetCounts.get(column.mappedField) ?? 0) + 1
      );
    }
  }

  for (const [field, count] of targetCounts) {
    if (count > 1) {
      errors.push(`${IMPORT_FIELD_LABELS[field]} is mapped from more than one column.`);
    }
  }

  const mapped = new Set(
    columns.map((column) => column.mappedField).filter((field): field is ImportField => !!field)
  );
  const missingRequiredFields = getRequiredImportFields(importType).filter(
    (field) => !mapped.has(field)
  );

  if (columns.some((column) => column.status === "AMBIGUOUS") || errors.length > 0) {
    return { status: "AMBIGUOUS", missingRequiredFields, errors };
  }
  if (missingRequiredFields.length > 0) {
    return { status: "NEEDS_MAPPING", missingRequiredFields, errors };
  }
  return { status: "READY", missingRequiredFields: [], errors };
}

function evaluateAnalysisSources(
  columns: readonly ImportColumn[],
  fieldSources: Partial<Record<ImportField, ImportFieldSource>>,
  importType: ImportRowType,
  reviewedFullNameSourceIndex: number | null,
  fullNameSuggestions: readonly FullNameRowSuggestion[]
): MappingResult {
  const base = evaluateColumnMapping(columns, importType);
  const mapped = new Set(
    columns
      .map((column) => column.mappedField)
      .filter((field): field is ImportField => !!field)
  );
  for (const field of Object.keys(fieldSources) as ImportField[]) mapped.add(field);
  if (
    reviewedFullNameSourceIndex !== null &&
    fullNameSuggestions.length > 0 &&
    fullNameSuggestions.every((suggestion) => suggestion.status === "REVIEW_REQUIRED")
  ) {
    mapped.add("firstName");
    mapped.add("lastName");
    mapped.add("middleName");
  }
  const missingRequiredFields = getRequiredImportFields(importType).filter(
    (field) => !mapped.has(field)
  );
  if (base.status === "AMBIGUOUS") {
    return { ...base, missingRequiredFields };
  }
  return {
    status: missingRequiredFields.length > 0 ? "NEEDS_MAPPING" : "READY",
    missingRequiredFields,
    errors: base.errors,
  };
}

export function isReviewedConstantAllowed(
  importType: ImportRowType,
  field: ImportField
): boolean {
  return CONSTANT_ALLOWED_FIELDS[importType].has(field);
}

export function applyManualColumnMapping(
  columns: readonly ImportColumn[],
  importType: ImportRowType,
  sourceIndex: number,
  targetField: ImportField | null
): { columns: ImportColumn[]; mapping: MappingResult } | { error: string } {
  const allowedFields = new Set(getImportFields(importType));
  if (targetField && !allowedFields.has(targetField)) {
    return { error: "That field is not available for the selected import type." };
  }

  if (
    targetField &&
    columns.some(
      (column) =>
        column.sourceIndex !== sourceIndex && column.mappedField === targetField
    )
  ) {
    return {
      error: `${IMPORT_FIELD_LABELS[targetField]} is already mapped from another column.`,
    };
  }

  let found = false;
  const nextColumns = columns.map((column) => {
    if (column.sourceIndex !== sourceIndex) return { ...column };
    found = true;
    return {
      ...column,
      mappedField: targetField,
      status: targetField ? ("MANUAL_MAPPED" as const) : ("IGNORED" as const),
      issue: undefined,
    };
  });

  if (!found) return { error: "Source column was not found." };
  return {
    columns: nextColumns,
    mapping: evaluateColumnMapping(nextColumns, importType),
  };
}

export function detectHeaderCandidates(
  matrix: readonly ImportMatrixRow[],
  importType: ImportRowType
): DetectedHeader[] {
  const aliasIndex = ALIAS_INDEX[importType];
  const roleSpecific = ROLE_SPECIFIC_FIELDS[importType];

  return matrix
    .filter((row) => row.rowNumber >= 1 && row.rowNumber <= MAX_HEADER_SCAN_ROWS)
    .filter((row) => row.cells.some((cell) => cell.text.trim() !== ""))
    .map((row) => {
      const headers = row.cells.map((cell) => cell.text);
      const duplicateHeaders = [...duplicateNormalizedHeaders(headers)];
      const recognized = new Set<ImportField>();
      for (const header of headers) {
        const field = aliasIndex.get(normalizeImportHeader(header));
        if (field) recognized.add(field);
      }
      const recognizedFields = [...recognized];
      const identityFieldCount = recognizedFields.filter((field) =>
        IDENTITY_FIELDS.has(field)
      ).length;
      const roleSpecificFieldCount = recognizedFields.filter((field) =>
        roleSpecific.has(field)
      ).length;
      const normalizedHeaders = headers.map(normalizeImportHeader).filter(Boolean);
      const blockingDuplicateHeaders = duplicateHeaders.filter(
        (header) => aliasIndex.has(header) || AMBIGUOUS_HEADERS.has(header)
      );
      const documentEvidence = [
        ...new Set(
          normalizedHeaders.filter(
            (header) => STRUCTURAL_HEADER_WEIGHTS[header] !== undefined
          )
        ),
      ];
      const negativeEvidence = [
        ...new Set(
          normalizedHeaders.filter(
            (header) => NEGATIVE_HEADER_WEIGHTS[header] !== undefined
          )
        ),
      ];
      const mappedFieldEvidence = recognizedFields.map(
        (field) => IMPORT_FIELD_LABELS[field]
      );
      const followingRows = matrix
        .filter(
          (candidate) =>
            candidate.rowNumber > row.rowNumber &&
            candidate.rowNumber <= row.rowNumber + 10
        )
        .slice(0, 5);
      let followingRecordCount = 0;
      let mostlyNumericFollowingCount = 0;
      for (const followingRow of followingRows) {
        const values = followingRow.cells
          .map((cell) => cell.text.trim())
          .filter(Boolean);
        const recognizedFollowingFields = new Set(
          values
            .map((value) => aliasIndex.get(normalizeImportHeader(value)))
            .filter((field): field is ImportField => !!field)
        );
        if (recognizedFollowingFields.size >= 4 || values.length < 2) continue;
        if (values.some((value) => /[\p{L}]/u.test(value))) {
          followingRecordCount += 1;
        }
        const numericCount = values.filter((value) =>
          /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value)
        ).length;
        if (numericCount >= Math.ceil(values.length * 0.75)) {
          mostlyNumericFollowingCount += 1;
        }
      }
      const structuralScore = documentEvidence.reduce(
        (sum, header) => sum + STRUCTURAL_HEADER_WEIGHTS[header],
        0
      );
      const negativeScore = negativeEvidence.reduce(
        (sum, header) => sum + NEGATIVE_HEADER_WEIGHTS[header],
        0
      );
      const score =
        recognizedFields.length * 4 +
        structuralScore -
        negativeScore +
        Math.min(followingRecordCount, 3) -
        Math.min(mostlyNumericFollowingCount, 2);
      const qualifies =
        recognizedFields.length >= 4 &&
        identityFieldCount >= 2 &&
        roleSpecificFieldCount >= 1 &&
        blockingDuplicateHeaders.length === 0;
      const isStructuralHeader =
        qualifies ||
        structuralScore >= 5 ||
        (normalizedHeaders.includes("no") && structuralScore >= 3);
      const preview = headers
        .filter((header) => header.trim())
        .slice(0, 6)
        .join(" | ");
      return {
        rowNumber: row.rowNumber,
        preview:
          preview.length > 120 ? `${preview.slice(0, 117).trimEnd()}...` : preview,
        recognizedFields,
        score,
        identityFieldCount,
        roleSpecificFieldCount,
        qualifies,
        isStructuralHeader,
        mappedFieldEvidence,
        documentEvidence,
        negativeEvidence,
        followingRecordCount,
        mostlyNumericFollowingCount,
        duplicateHeaders,
      };
    })
    .sort(
      (a, b) =>
        Number(b.qualifies) - Number(a.qualifies) ||
        Number(b.isStructuralHeader) - Number(a.isStructuralHeader) ||
        b.score - a.score ||
        a.rowNumber - b.rowNumber
    )
    .slice(0, 3);
}

export function selectDetectedHeader(
  candidates: readonly DetectedHeader[]
): DetectedHeader | null {
  const qualified = candidates
    .filter((candidate) => candidate.qualifies)
    .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);

  if (qualified.length === 0) {
    const structural = candidates
      .filter((candidate) => candidate.isStructuralHeader)
      .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);
    if (structural.length === 0) return null;
    if (structural.length === 1) return structural[0];
    return structural[0].score - structural[1].score >= 3
      ? structural[0]
      : null;
  }
  if (qualified.length === 1) return qualified[0];
  return qualified[0].score - qualified[1].score >= 2 ? qualified[0] : null;
}

export function selectClearlySuperiorSheet(
  sheets: readonly ImportSheetCandidate[]
): ImportSheetCandidate | null {
  const ranked = sheets
    .filter((sheet) => sheet.selectedHeaderRow !== null)
    .map((sheet) => ({
      sheet,
      score:
        sheet.headerCandidates.find(
          (candidate) => candidate.rowNumber === sheet.selectedHeaderRow
        )?.score ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((left, right) => right.score - left.score);
  if (ranked.length === 0) return null;
  if (ranked.length === 1) return ranked[0].sheet;
  return ranked[0].score - ranked[1].score >= 3 ? ranked[0].sheet : null;
}

export function matrixFromValues(values: readonly unknown[][]): ImportMatrixRow[] {
  return values
    .map((row, index) => ({
      rowNumber: index + 1,
      cells: row.map((value) => ({ text: value == null ? "" : String(value) })),
    }))
    .filter((row) => row.cells.some((cell) => cell.text.trim() !== ""));
}

export function analyzeImportMatrix(
  matrix: readonly ImportMatrixRow[],
  importType: ImportRowType,
  options: {
    fileType: ImportFileFormat;
    sheetName: string;
    forcedHeaderRow?: number;
    isOfficialTemplate?: boolean;
  }
): AnalyzeMatrixResult {
  if (matrix.length > MAX_HEADER_SCAN_ROWS + MAX_IMPORT_DATA_ROWS) {
    return {
      error: `This file has more than ${MAX_IMPORT_DATA_ROWS} data rows within the supported header area. Split it into smaller files and try again.`,
    };
  }

  const maxColumns = matrix.reduce(
    (maximum, row) => Math.max(maximum, row.cells.length),
    0
  );
  if (maxColumns > MAX_IMPORT_COLUMNS) {
    return {
      error: `This file has more than ${MAX_IMPORT_COLUMNS} columns. Remove unused columns and try again.`,
    };
  }

  const headerCandidates = detectHeaderCandidates(matrix, importType);
  let selectedHeader: DetectedHeader | null = null;

  if (options.forcedHeaderRow !== undefined) {
    if (
      options.forcedHeaderRow < 1 ||
      options.forcedHeaderRow > MAX_HEADER_SCAN_ROWS
    ) {
      return {
        error: `Choose a header row between 1 and ${MAX_HEADER_SCAN_ROWS}.`,
      };
    }
    selectedHeader =
      headerCandidates.find(
        (candidate) => candidate.rowNumber === options.forcedHeaderRow
      ) ?? null;
    if (!selectedHeader) {
      return { error: `Row ${options.forcedHeaderRow} is empty and cannot be used as a header.` };
    }
  } else {
    selectedHeader = selectDetectedHeader(headerCandidates);
  }

  if (!selectedHeader) {
    const metadata = extractDocumentMetadata(
      matrix,
      options.sheetName,
      null,
      MAX_HEADER_SCAN_ROWS
    );
    const document = classifyImportDocument({
      matrix,
      importType,
      candidates: headerCandidates,
      selectedHeader: null,
      metadata,
      isOfficialTemplate: options.isOfficialTemplate,
      mappingReady: false,
      needsReview: true,
    });
    return {
      analysis: {
        fileType: options.fileType,
        sheetName: options.sheetName,
        headerCandidates,
        selectedHeaderRow: null,
        columns: [],
        sourceRows: [],
        rowClassifications: [],
        skippedRowCount: 0,
        metadata,
        document,
        fieldSources: {},
        reviewedFullNameSourceIndex: null,
        fullNameSuggestions: [],
        mappingStatus: "AMBIGUOUS",
        missingRequiredFields: [...getRequiredImportFields(importType)],
        hasLegacyPasswordColumn: false,
      },
    };
  }

  const headerMatrixRow = matrix.find(
    (row) => row.rowNumber === selectedHeader!.rowNumber
  )!;
  const headers = headerMatrixRow.cells.map((cell) => cell.text);
  const columns = buildAutomaticColumns(headers, importType);
  const metadata = extractDocumentMetadata(
    matrix,
    options.sheetName,
    selectedHeader.rowNumber,
    MAX_HEADER_SCAN_ROWS
  );
  const safeMetadata = uniqueSafeMetadataByField(metadata);
  const columnFields = new Set(
    columns
      .map((column) => column.mappedField)
      .filter((field): field is ImportField => !!field)
  );
  const fieldSources: Partial<Record<ImportField, ImportFieldSource>> = {};
  for (const [field, item] of Object.entries(safeMetadata) as [
    ImportField,
    DocumentMetadata,
  ][]) {
    if (
      !columnFields.has(field) &&
      getImportFields(importType).includes(field) &&
      isReviewedConstantAllowed(importType, field) &&
      item.canonicalValue
    ) {
      fieldSources[field] = {
        kind: "DOCUMENT_METADATA",
        value: item.canonicalValue,
        metadataId: item.id,
      };
    }
  }
  const fullNameSourceIndex = headers.findIndex((header) =>
    FULL_NAME_HEADERS.has(normalizeImportHeader(header))
  );
  const allRowsAfterHeader = matrix
    .filter((row) => row.rowNumber > selectedHeader!.rowNumber)
    .filter((row) =>
      row.cells.some((cell) => cell.isFormula || cell.text.trim() !== "")
    );
  const rowClassifications = classifyImportRows(allRowsAfterHeader, {
    ...(fullNameSourceIndex >= 0 ? { nameColumnIndex: fullNameSourceIndex } : {}),
    mappedColumnIndexes: columns
      .filter((column) => column.mappedField !== null)
      .map((column) => column.sourceIndex),
  });
  const includedRows = new Set(
    rowClassifications
      .filter((entry) => entry.classification === "RECORD" || entry.classification === "UNCERTAIN")
      .map((entry) => entry.rowNumber)
  );
  const sourceRows = allRowsAfterHeader.filter((row) => includedRows.has(row.rowNumber));
  const fullNameSuggestions: FullNameRowSuggestion[] =
    fullNameSourceIndex < 0
      ? []
      : sourceRows
          .map((row) => {
            const suggestion = parseReviewedFullName(
              row.cells[fullNameSourceIndex]?.text ?? ""
            );
            return suggestion ? { ...suggestion, rowNumber: row.rowNumber } : null;
          })
          .filter((item): item is FullNameRowSuggestion => item !== null);
  const mapping = evaluateAnalysisSources(
    columns,
    fieldSources,
    importType,
    null,
    fullNameSuggestions
  );

  if (sourceRows.length > MAX_IMPORT_DATA_ROWS) {
    return {
      error: `This file has more than ${MAX_IMPORT_DATA_ROWS} data rows. Split it into smaller files and try again.`,
    };
  }

  return {
    analysis: {
      fileType: options.fileType,
      sheetName: options.sheetName,
      headerCandidates,
      selectedHeaderRow: selectedHeader.rowNumber,
      columns,
      sourceRows,
      rowClassifications,
      skippedRowCount: rowClassifications.filter(
        (entry) => entry.classification === "NON_RECORD" || entry.classification === "FOOTER"
      ).length,
      metadata,
      document: classifyImportDocument({
        matrix,
        importType,
        candidates: headerCandidates,
        selectedHeader,
        metadata,
        isOfficialTemplate: options.isOfficialTemplate,
        mappingReady: mapping.status === "READY",
        needsReview: mapping.status === "AMBIGUOUS",
      }),
      fieldSources,
      reviewedFullNameSourceIndex: null,
      fullNameSuggestions,
      mappingStatus: mapping.status,
      missingRequiredFields: mapping.missingRequiredFields,
      hasLegacyPasswordColumn: headers.some(
        (header) => normalizeImportHeader(header) === "password"
      ),
    },
  };
}

export function updateAnalysisMapping(
  analysis: ImportMatrixAnalysis,
  importType: ImportRowType,
  sourceIndex: number,
  targetField: ImportField | null
): { analysis: ImportMatrixAnalysis } | { error: string } {
  const result = applyManualColumnMapping(
    analysis.columns,
    importType,
    sourceIndex,
    targetField
  );
  if ("error" in result) return result;

  const fieldSources = { ...analysis.fieldSources };
  if (targetField) delete fieldSources[targetField];
  const reviewedFullNameSourceIndex =
    targetField && ["firstName", "middleName", "lastName"].includes(targetField)
      ? null
      : analysis.reviewedFullNameSourceIndex;

  const mapping = evaluateAnalysisSources(
    result.columns,
    fieldSources,
    importType,
    reviewedFullNameSourceIndex,
    analysis.fullNameSuggestions
  );
  return {
    analysis: {
      ...analysis,
      columns: result.columns,
      fieldSources,
      reviewedFullNameSourceIndex,
      mappingStatus: mapping.status,
      missingRequiredFields: mapping.missingRequiredFields,
      document: {
        ...analysis.document,
        status: userStatusForMapping(mapping.status),
      },
    },
  };
}

export function resetAnalysisMapping(
  analysis: ImportMatrixAnalysis,
  importType: ImportRowType
): ImportMatrixAnalysis {
  const columns = buildAutomaticColumns(
    analysis.columns.map((column) => column.sourceHeader),
    importType
  );
  const mapping = evaluateAnalysisSources(
    columns,
    {},
    importType,
    null,
    analysis.fullNameSuggestions
  );
  return {
    ...analysis,
    columns,
    fieldSources: {},
    reviewedFullNameSourceIndex: null,
    mappingStatus: mapping.status,
    missingRequiredFields: mapping.missingRequiredFields,
    document: {
      ...analysis.document,
      status: userStatusForMapping(mapping.status),
    },
  };
}

export function updateAnalysisFieldSource(
  analysis: ImportMatrixAnalysis,
  importType: ImportRowType,
  field: ImportField,
  source: ImportFieldSource | null
): { analysis: ImportMatrixAnalysis } | { error: string } {
  if (!getImportFields(importType).includes(field)) {
    return { error: "That field is not available for the selected import type." };
  }
  if (source?.kind === "REVIEWED_CONSTANT" && !isReviewedConstantAllowed(importType, field)) {
    return { error: `${IMPORT_FIELD_LABELS[field]} cannot be supplied as a constant.` };
  }
  if (source?.kind === "DOCUMENT_METADATA") {
    const metadata = analysis.metadata.find((item) => item.id === source.metadataId);
    if (
      !isReviewedConstantAllowed(importType, field) ||
      !metadata ||
      metadata.canonicalField !== field ||
      metadata.canonicalValue !== source.value ||
      (metadata.status !== "DETECTED" && metadata.status !== "DERIVED_SAFELY")
    ) {
      return { error: "That document value is not a safe source for this field." };
    }
  }
  if (source && !source.value.trim()) return { error: "Enter a non-empty value." };
  if (source && analysis.columns.some((column) => column.mappedField === field)) {
    return { error: `${IMPORT_FIELD_LABELS[field]} is already mapped from a column.` };
  }
  const fieldSources = { ...analysis.fieldSources };
  if (source) fieldSources[field] = { ...source, value: source.value.trim() };
  else delete fieldSources[field];
  const mapping = evaluateAnalysisSources(
    analysis.columns,
    fieldSources,
    importType,
    analysis.reviewedFullNameSourceIndex,
    analysis.fullNameSuggestions
  );
  return {
    analysis: {
      ...analysis,
      fieldSources,
      mappingStatus: mapping.status,
      missingRequiredFields: mapping.missingRequiredFields,
      document: {
        ...analysis.document,
        status: userStatusForMapping(mapping.status),
      },
    },
  };
}

export function updateReviewedFullNameSource(
  analysis: ImportMatrixAnalysis,
  importType: ImportRowType,
  sourceIndex: number | null
): { analysis: ImportMatrixAnalysis } | { error: string } {
  if (sourceIndex !== null) {
    const source = analysis.columns.find((column) => column.sourceIndex === sourceIndex);
    if (!source || !FULL_NAME_HEADERS.has(source.normalizedHeader)) {
      return { error: "Choose a recognized full-name source column." };
    }
    if (
      analysis.fullNameSuggestions.length !== analysis.sourceRows.length ||
      analysis.fullNameSuggestions.some((suggestion) => suggestion.status === "AMBIGUOUS")
    ) {
      return { error: "One or more full names are ambiguous and must be corrected before use." };
    }
    for (const field of ["firstName", "middleName", "lastName"] as ImportField[]) {
      if (analysis.columns.some((column) => column.mappedField === field)) {
        return { error: `${IMPORT_FIELD_LABELS[field]} is already mapped from a column.` };
      }
    }
  }
  const mapping = evaluateAnalysisSources(
    analysis.columns,
    analysis.fieldSources,
    importType,
    sourceIndex,
    analysis.fullNameSuggestions
  );
  return {
    analysis: {
      ...analysis,
      reviewedFullNameSourceIndex: sourceIndex,
      mappingStatus: mapping.status,
      missingRequiredFields: mapping.missingRequiredFields,
      document: {
        ...analysis.document,
        status: userStatusForMapping(mapping.status),
      },
    },
  };
}

export function mapSourceRows(
  analysis: ImportMatrixAnalysis
): MappedImportRow[] {
  return analysis.sourceRows.map((sourceRow) => {
    const raw: Record<string, string> = {};
    const parsingErrors: string[] = [];

    for (const column of analysis.columns) {
      if (!column.mappedField) continue;
      const cell = sourceRow.cells[column.sourceIndex] ?? { text: "" };
      if (cell.isFormula) {
        if (!parsingErrors.includes("Formula cells are not supported for imported user fields.")) {
          parsingErrors.push(
            "Formula cells are not supported for imported user fields."
          );
        }
        raw[column.mappedField] = "";
      } else if (cell.isError) {
        if (
          !parsingErrors.includes(
            "Excel error cells are not supported for imported user fields."
          )
        ) {
          parsingErrors.push(
            "Excel error cells are not supported for imported user fields."
          );
        }
        raw[column.mappedField] = "";
      } else {
        raw[column.mappedField] = cell.text;
        if (
          column.mappedField === "idNumber" &&
          (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/iu.test(cell.text.trim()) ||
            /^\d+$/u.test(cell.text.trim()))
        ) {
          parsingErrors.push(
            "Excel appears to have changed this ID into a number. Verify the original ID."
          );
        }
      }
    }

    for (const [field, source] of Object.entries(analysis.fieldSources) as [
      ImportField,
      ImportFieldSource,
    ][]) {
      raw[field] = source.value;
    }

    if (analysis.reviewedFullNameSourceIndex !== null) {
      const suggestion = analysis.fullNameSuggestions.find(
        (item) => item.rowNumber === sourceRow.rowNumber
      );
      if (suggestion?.status === "REVIEW_REQUIRED") {
        raw.firstName = suggestion.firstName;
        raw.middleName = suggestion.middleName;
        raw.lastName = suggestion.lastName;
      } else {
        parsingErrors.push("The full name could not be split safely and requires review.");
      }
    }

    return { rowNumber: sourceRow.rowNumber, raw, parsingErrors };
  });
}
