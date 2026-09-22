import type { ImportCell } from "./masterlist-mapping";

export type ImportRowClass = "RECORD" | "NON_RECORD" | "FOOTER" | "UNCERTAIN";

export type RowClassification = {
  rowNumber: number;
  classification: ImportRowClass;
  reason: string;
};

export type FullNameSuggestion = {
  original: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  status: "REVIEW_REQUIRED" | "AMBIGUOUS";
};

const FOOTER_PHRASES = [
  "prepared by",
  "checked by",
  "certified correct",
  "approved by",
  "noted by",
  "total students",
  "total number",
  "signature",
];
const SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV"]);

function texts(cells: readonly ImportCell[]): string[] {
  return cells.map((cell) => cell.text.trim()).filter(Boolean);
}

export function parseReviewedFullName(value: string): FullNameSuggestion | null {
  const original = value.trim().replace(/\s+/gu, " ");
  if (!original) return null;
  const comma = /^([^,]+),\s*(.+)$/u.exec(original);
  if (!comma) {
    return {
      original,
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      status: "AMBIGUOUS",
    };
  }

  const surname = comma[1].trim();
  const givenParts = comma[2].trim().split(/\s+/u);
  let suffix = "";
  if (givenParts.length > 1 && SUFFIXES.has(givenParts[givenParts.length - 1].toUpperCase())) {
    suffix = givenParts.pop()!;
  }
  const firstName = givenParts.shift() ?? "";
  const middleName = givenParts.join(" ");
  if (!surname || !firstName) {
    return { original, firstName, middleName, lastName: surname, suffix, status: "AMBIGUOUS" };
  }
  return {
    original,
    firstName,
    middleName,
    // The current user model has no suffix field. Keeping it with lastName is
    // lossless and requires explicit review before the suggestion is applied.
    lastName: suffix ? `${surname} ${suffix}` : surname,
    suffix,
    status: "REVIEW_REQUIRED",
  };
}

export function classifyImportRow(
  rowNumber: number,
  cells: readonly ImportCell[],
  options: { nameColumnIndex?: number; mappedColumnIndexes?: readonly number[] } = {}
): RowClassification {
  const values = texts(cells);
  if (values.length === 0) {
    return { rowNumber, classification: "NON_RECORD", reason: "Blank row" };
  }
  const combined = values.join(" ").toLowerCase();
  if (FOOTER_PHRASES.some((phrase) => combined.includes(phrase))) {
    return { rowNumber, classification: "FOOTER", reason: "Footer or sign-off text" };
  }
  if (
    values.length <= 3 &&
    values.some((value) => /^(?:total|notes?|grading legend|instructor|dean|registrar)\s*:?$/iu.test(value))
  ) {
    return { rowNumber, classification: "FOOTER", reason: "Summary, personnel, or notes row" };
  }
  if (values.length === 1 && /^\d+[.)]?$/u.test(values[0])) {
    return { rowNumber, classification: "NON_RECORD", reason: "Serial-only row" };
  }

  const name =
    options.nameColumnIndex === undefined
      ? ""
      : (cells[options.nameColumnIndex]?.text.trim() ?? "");
  if (name && /[\p{L}]/u.test(name)) {
    return { rowNumber, classification: "RECORD", reason: "Contains a student or faculty name" };
  }

  const mappedValues = (options.mappedColumnIndexes ?? [])
    .map((index) => cells[index]?.text.trim() ?? "")
    .filter(Boolean);
  if (mappedValues.length >= 2) {
    return { rowNumber, classification: "RECORD", reason: "Contains values in mapped record columns" };
  }
  return { rowNumber, classification: "UNCERTAIN", reason: "Contains data but lacks enough record evidence" };
}

export function classifyImportRows(
  rows: readonly { rowNumber: number; cells: ImportCell[] }[],
  options: { nameColumnIndex?: number; mappedColumnIndexes?: readonly number[] } = {}
): RowClassification[] {
  return rows.map((row) => classifyImportRow(row.rowNumber, row.cells, options));
}
