import Papa from "papaparse";
import {
  importFileFailure,
  type ImportFileFailure,
} from "./file-format";

export const SUPPORTED_CSV_DELIMITERS = [",", ";", "\t"] as const;
export type SupportedCsvDelimiter =
  (typeof SUPPORTED_CSV_DELIMITERS)[number];

export type ParseCsvSuccess = {
  values: string[][];
  delimiter: SupportedCsvDelimiter;
};

export type ParseCsvResult = ParseCsvSuccess | ImportFileFailure;

const CSV_DELIMITER_SAMPLE_ROWS = 50;

type DelimiterCandidate = {
  delimiter: SupportedCsvDelimiter;
  meaningfulRows: number;
  multiColumnRows: number;
  consistentRows: number;
  distinctWidths: number;
};

function delimiterCandidate(
  text: string,
  delimiter: SupportedCsvDelimiter
): DelimiterCandidate | null {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    delimiter,
    preview: CSV_DELIMITER_SAMPLE_ROWS,
  });
  if (result.errors.length > 0) return null;

  const rows = result.data.filter((row) =>
    row.some((value) => value.trim() !== "")
  );
  const widths = rows.map((row) => row.length);
  const widthFrequency = new Map<number, number>();
  for (const width of widths) {
    widthFrequency.set(width, (widthFrequency.get(width) ?? 0) + 1);
  }

  const multiColumnRows = widths.filter((width) => width > 1).length;
  if (rows.length === 0 || multiColumnRows === 0) return null;
  return {
    delimiter,
    meaningfulRows: rows.length,
    multiColumnRows,
    consistentRows: Math.max(...widthFrequency.values()),
    distinctWidths: widthFrequency.size,
  };
}

function compareDelimiterCandidates(
  left: DelimiterCandidate,
  right: DelimiterCandidate
): number {
  return (
    left.multiColumnRows - right.multiColumnRows ||
    left.consistentRows - right.consistentRows ||
    right.distinctWidths - left.distinctWidths ||
    left.meaningfulRows - right.meaningfulRows
  );
}

function selectCsvDelimiter(text: string): SupportedCsvDelimiter | null {
  const candidates = SUPPORTED_CSV_DELIMITERS.map((delimiter) =>
    delimiterCandidate(text, delimiter)
  ).filter((candidate): candidate is DelimiterCandidate => candidate !== null);
  if (candidates.length === 0) return null;

  candidates.sort((left, right) => compareDelimiterCandidates(right, left));
  if (
    candidates.length > 1 &&
    compareDelimiterCandidates(candidates[0], candidates[1]) === 0
  ) {
    return null;
  }
  return candidates[0].delimiter;
}

export function parseCsvImportBytes(bytes: Uint8Array): ParseCsvResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return importFileFailure(
      "CORRUPT_OR_UNREADABLE",
      "This CSV is not valid UTF-8 text. Export it as UTF-8 and try again."
    );
  }

  const delimiter = selectCsvDelimiter(text);
  if (!delimiter) {
    return importFileFailure(
      "PARSE_ERROR",
      "We couldn't determine whether this CSV uses commas, semicolons, or tabs. Check the delimiter and try again."
    );
  }

  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    delimiter,
  });

  if (result.errors.length > 0) {
    return importFileFailure(
      "PARSE_ERROR",
      "We couldn't read this CSV safely. Check its quoted values and delimiters, then try again."
    );
  }

  return {
    values: result.data,
    delimiter,
  };
}
