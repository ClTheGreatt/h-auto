import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  YEAR_LEVELS,
  isCanonicalCourse,
  isValidAcademicYear,
} from "@/lib/constants/user-import";
import type { ImportMatrixRow } from "./masterlist-mapping";

export type MetadataStatus =
  | "DETECTED"
  | "DERIVED_SAFELY"
  | "REQUIRES_CONFIRMATION"
  | "UNSUPPORTED_VALUE";

export type MetadataLabel =
  | "PROGRAM"
  | "COURSE"
  | "PROGRAM_YEAR_SECTION"
  | "YEAR_LEVEL"
  | "SECTION"
  | "DEPARTMENT"
  | "COLLEGE"
  | "ACADEMIC_YEAR"
  | "SEMESTER"
  | "INSTRUCTOR"
  | "COURSE_CODE"
  | "COURSE_TITLE";

export type DocumentMetadata = {
  id: string;
  label: MetadataLabel;
  originalLabel: string;
  displayLabel: string;
  value: string;
  sheetName: string;
  rowNumber: number;
  canonicalField: "course" | "yearLevel" | "section" | "academicYear" | "department" | "position" | null;
  canonicalValue: string | null;
  status: MetadataStatus;
};

const LABELS: Array<{ label: MetadataLabel; displayLabel: string; pattern: RegExp }> = [
  { label: "PROGRAM_YEAR_SECTION", displayLabel: "Program / Year & Section", pattern: /^program\s*\/?\s*year\s*(?:&|and)\s*section$/iu },
  { label: "ACADEMIC_YEAR", displayLabel: "Academic Year", pattern: /^(?:academic\s*year|a\.?\s*y\.?)$/iu },
  { label: "YEAR_LEVEL", displayLabel: "Year Level", pattern: /^year\s*level$/iu },
  { label: "COURSE_CODE", displayLabel: "Course Code", pattern: /^course\s*code$/iu },
  { label: "COURSE_TITLE", displayLabel: "Course Title", pattern: /^course\s*title$/iu },
  { label: "DEPARTMENT", displayLabel: "Department", pattern: /^(?:department|dept\.?)$/iu },
  { label: "INSTRUCTOR", displayLabel: "Instructor", pattern: /^(?:instructor|faculty)$/iu },
  { label: "SEMESTER", displayLabel: "Semester", pattern: /^(?:semester|term)$/iu },
  { label: "COLLEGE", displayLabel: "College", pattern: /^college$/iu },
  { label: "PROGRAM", displayLabel: "Program", pattern: /^(?:program|degree\s*program)$/iu },
  { label: "COURSE", displayLabel: "Course", pattern: /^course$/iu },
  { label: "SECTION", displayLabel: "Section", pattern: /^section$/iu },
];

function clean(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function findLabel(value: string) {
  const normalized = clean(value).replace(/\s*:\s*$/u, "");
  return LABELS.find((entry) => entry.pattern.test(normalized)) ?? null;
}

function canonicalCourse(value: string): string | null {
  const normalized = clean(value);
  if (isCanonicalCourse(normalized)) return normalized;
  const exact = DEPARTMENTS.find(
    (item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase()
  );
  return exact ?? null;
}

function canonicalYearLevel(value: string): string | null {
  const normalized = clean(value).toLowerCase();
  const ordinal = /^(?:year\s*)?([1-4])(?:st|nd|rd|th)?(?:\s*year)?$/u.exec(normalized);
  if (!ordinal) return null;
  return YEAR_LEVELS[Number(ordinal[1]) - 1] ?? null;
}

function canonicalSection(value: string): string | null {
  const compact = clean(value).toUpperCase().replace(/[\s_]+/gu, "-");
  const match = /^(BSA|BTVTED|BSABE)-?([1-4])([A-Z])$/u.exec(compact);
  return match ? `${match[1]}-${match[2]}${match[3]}` : null;
}

function canonicalPosition(value: string): string | null {
  const normalized = clean(value);
  return (
    FACULTY_POSITIONS.find(
      (item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase()
    ) ?? null
  );
}

function interpretMetadata(
  label: MetadataLabel,
  value: string
): Pick<DocumentMetadata, "canonicalField" | "canonicalValue" | "status"> {
  if (label === "ACADEMIC_YEAR") {
    return isValidAcademicYear(value)
      ? { canonicalField: "academicYear", canonicalValue: value, status: "DETECTED" }
      : { canonicalField: "academicYear", canonicalValue: null, status: "UNSUPPORTED_VALUE" };
  }
  if (label === "YEAR_LEVEL") {
    const canonicalValue = canonicalYearLevel(value);
    return {
      canonicalField: "yearLevel",
      canonicalValue,
      status: canonicalValue ? "DERIVED_SAFELY" : "UNSUPPORTED_VALUE",
    };
  }
  if (label === "SECTION") {
    const canonicalValue = canonicalSection(value);
    return {
      canonicalField: "section",
      canonicalValue,
      status: canonicalValue ? "DERIVED_SAFELY" : "UNSUPPORTED_VALUE",
    };
  }
  if (label === "PROGRAM" || label === "COURSE") {
    const canonicalValue = canonicalCourse(value);
    return {
      canonicalField: "course",
      canonicalValue,
      status: canonicalValue ? "DETECTED" : "UNSUPPORTED_VALUE",
    };
  }
  if (label === "DEPARTMENT") {
    const canonicalValue = canonicalCourse(value);
    return {
      canonicalField: "department",
      canonicalValue,
      status: canonicalValue ? "DETECTED" : "UNSUPPORTED_VALUE",
    };
  }
  if (label === "PROGRAM_YEAR_SECTION") {
    const section = canonicalSection(value);
    if (section) {
      return { canonicalField: "section", canonicalValue: section, status: "DERIVED_SAFELY" };
    }
    // A compact but unsupported program such as BSIT 1A is evidence only.
    // It is never rewritten into one of H-Auto's canonical programs.
    return { canonicalField: null, canonicalValue: null, status: "UNSUPPORTED_VALUE" };
  }
  if (label === "INSTRUCTOR") {
    const canonicalValue = canonicalPosition(value);
    return {
      canonicalField: canonicalValue ? "position" : null,
      canonicalValue,
      status: canonicalValue ? "REQUIRES_CONFIRMATION" : "DETECTED",
    };
  }
  return { canonicalField: null, canonicalValue: null, status: "DETECTED" };
}

function pushMetadata(
  output: DocumentMetadata[],
  sheetName: string,
  rowNumber: number,
  labelInfo: (typeof LABELS)[number],
  rawValue: string,
  originalLabel: string
) {
  const value = clean(rawValue);
  if (!value) return;
  const interpreted = interpretMetadata(labelInfo.label, value);
  output.push({
    id: `${sheetName}:${rowNumber}:${labelInfo.label}:${output.length}`,
    label: labelInfo.label,
    originalLabel: clean(originalLabel),
    displayLabel: labelInfo.displayLabel,
    value,
    sheetName,
    rowNumber,
    ...interpreted,
  });
}

export function extractDocumentMetadata(
  matrix: readonly ImportMatrixRow[],
  sheetName: string,
  headerRow: number | null,
  scanLimit = 50
): DocumentMetadata[] {
  const output: DocumentMetadata[] = [];
  const maximumRow = Math.min(headerRow ?? scanLimit, scanLimit);

  for (const row of matrix) {
    if (row.rowNumber > maximumRow) continue;
    const values = row.cells.map((cell) =>
      cell.isFormula || cell.isError ? "" : clean(cell.text)
    );
    for (let index = 0; index < values.length; index += 1) {
      const text = values[index];
      if (!text) continue;

      const inline = /^([^:]{2,40})\s*:\s*(.+)$/u.exec(text);
      if (inline) {
        const labelInfo = findLabel(inline[1]);
        if (labelInfo) pushMetadata(output, sheetName, row.rowNumber, labelInfo, inline[2], inline[1]);
        continue;
      }

      const labelInfo = findLabel(text);
      if (!labelInfo) continue;
      const adjacent = values.slice(index + 1).find(Boolean) ?? "";
      if (adjacent && !findLabel(adjacent)) {
        pushMetadata(output, sheetName, row.rowNumber, labelInfo, adjacent, text);
      }
    }
  }

  const seen = new Set<string>();
  return output.filter((item) => {
    const key = `${item.label}:${item.value.toLocaleLowerCase()}:${item.rowNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function uniqueSafeMetadataByField(
  metadata: readonly DocumentMetadata[]
): Partial<Record<NonNullable<DocumentMetadata["canonicalField"]>, DocumentMetadata>> {
  const grouped = new Map<string, DocumentMetadata[]>();
  for (const item of metadata) {
    if (!item.canonicalField || !item.canonicalValue) continue;
    if (item.status !== "DETECTED" && item.status !== "DERIVED_SAFELY") continue;
    const entries = grouped.get(item.canonicalField) ?? [];
    entries.push(item);
    grouped.set(item.canonicalField, entries);
  }
  const result: Partial<Record<NonNullable<DocumentMetadata["canonicalField"]>, DocumentMetadata>> = {};
  for (const [field, entries] of grouped) {
    const values = new Set(entries.map((entry) => entry.canonicalValue));
    if (values.size === 1) {
      result[field as NonNullable<DocumentMetadata["canonicalField"]>] = entries[0];
    }
  }
  return result;
}
