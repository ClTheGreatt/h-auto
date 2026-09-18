import {
  FACULTY_IMPORT_COLUMNS,
  FACULTY_REQUIRED_FIELDS,
  STUDENT_IMPORT_COLUMNS,
  STUDENT_REQUIRED_FIELDS,
  type ImportRowType,
} from "@/lib/constants/user-import";

export const MAX_IMPORT_WORKSHEETS = 10;
export const MAX_HEADER_SCAN_ROWS = 20;
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

export type MappingResult = {
  status: ImportMappingStatus;
  missingRequiredFields: ImportField[];
  errors: string[];
};

export type ImportMatrixAnalysis = {
  fileType: "csv" | "xlsx";
  sheetName: string;
  headerCandidates: DetectedHeader[];
  selectedHeaderRow: number | null;
  columns: ImportColumn[];
  sourceRows: ImportSourceRow[];
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
]);

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

    if (duplicateHeaders.has(normalizedHeader)) {
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
      const score = recognizedFields.length;
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
        qualifies:
          score >= 4 &&
          identityFieldCount >= 2 &&
          roleSpecificFieldCount >= 1 &&
          duplicateHeaders.length === 0,
        duplicateHeaders,
      };
    });
}

export function selectDetectedHeader(
  candidates: readonly DetectedHeader[]
): DetectedHeader | null {
  const qualified = candidates
    .filter((candidate) => candidate.qualifies)
    .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);

  if (qualified.length === 0) return null;
  if (qualified.length === 1) return qualified[0];
  return qualified[0].score - qualified[1].score >= 2 ? qualified[0] : null;
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
    fileType: "csv" | "xlsx";
    sheetName: string;
    forcedHeaderRow?: number;
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
    return {
      analysis: {
        fileType: options.fileType,
        sheetName: options.sheetName,
        headerCandidates,
        selectedHeaderRow: null,
        columns: [],
        sourceRows: [],
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
  const mapping = evaluateColumnMapping(columns, importType);
  const sourceRows = matrix
    .filter((row) => row.rowNumber > selectedHeader!.rowNumber)
    .filter((row) =>
      row.cells.some((cell) => cell.isFormula || cell.text.trim() !== "")
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

  return {
    analysis: {
      ...analysis,
      columns: result.columns,
      mappingStatus: result.mapping.status,
      missingRequiredFields: result.mapping.missingRequiredFields,
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
  const mapping = evaluateColumnMapping(columns, importType);
  return {
    ...analysis,
    columns,
    mappingStatus: mapping.status,
    missingRequiredFields: mapping.missingRequiredFields,
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
      }
    }

    return { rowNumber: sourceRow.rowNumber, raw, parsingErrors };
  });
}
