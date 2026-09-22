import type { ImportRowType } from "@/lib/constants/user-import";
import type { DetectedHeader, ImportMatrixRow } from "./masterlist-mapping";
import type { DocumentMetadata } from "./metadata-extractor";

export type ImportDocumentType =
  | "OFFICIAL_HAUTO_TEMPLATE"
  | "STUDENT_MASTERLIST"
  | "FACULTY_MASTERLIST"
  | "MIXED_MASTERLIST"
  | "CLASS_LIST"
  | "CLASS_GRADE_RECORD"
  | "ATTENDANCE_OR_RECORD_SHEET"
  | "UNKNOWN_TABULAR_DOCUMENT";

export type ImportUserStatus =
  | "READY"
  | "NEEDS_REVIEW"
  | "MISSING_REQUIRED_INFORMATION"
  | "UNSUPPORTED_UNREADABLE";

export type DocumentIntelligence = {
  documentType: ImportDocumentType;
  status: ImportUserStatus;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[];
  importTypeWarning: string | null;
};

export const DOCUMENT_TYPE_LABELS: Record<ImportDocumentType, string> = {
  OFFICIAL_HAUTO_TEMPLATE: "Official H-Auto template",
  STUDENT_MASTERLIST: "Student masterlist",
  FACULTY_MASTERLIST: "Faculty masterlist",
  MIXED_MASTERLIST: "Mixed masterlist",
  CLASS_LIST: "Class list",
  CLASS_GRADE_RECORD: "Class grade record",
  ATTENDANCE_OR_RECORD_SHEET: "Attendance or record sheet",
  UNKNOWN_TABULAR_DOCUMENT: "Unknown tabular document",
};

function documentText(matrix: readonly ImportMatrixRow[]): string {
  return matrix
    .slice(0, 50)
    .flatMap((row) => row.cells.map((cell) => cell.text.trim().toLowerCase()))
    .filter(Boolean)
    .join(" | ");
}

export function classifyImportDocument(options: {
  matrix: readonly ImportMatrixRow[];
  importType: ImportRowType;
  candidates: readonly DetectedHeader[];
  selectedHeader: DetectedHeader | null;
  metadata: readonly DocumentMetadata[];
  isOfficialTemplate?: boolean;
  mappingReady: boolean;
  needsReview?: boolean;
}): DocumentIntelligence {
  if (options.isOfficialTemplate) {
    return {
      documentType: "OFFICIAL_HAUTO_TEMPLATE",
      status: options.mappingReady
        ? "READY"
        : options.needsReview
          ? "NEEDS_REVIEW"
          : "MISSING_REQUIRED_INFORMATION",
      confidence: "HIGH",
      evidence: ["Verified H-Auto workbook marker", "Data worksheet uses the official header row"],
      importTypeWarning: null,
    };
  }

  const text = documentText(options.matrix);
  const hasStudent = /\b(student|students|learner)\b/u.test(text);
  const hasFaculty = /\b(faculty|employee|instructor)\b/u.test(text);
  const hasGrade = /\b(mid[ -]?term|final grade|activity|quiz|equiv|grade)\b/u.test(text);
  const hasAttendance = /\b(attendance|present|absent|tardy|time in|time out)\b/u.test(text);
  const titleMasterlist = /\b(master\s*list|masterlist)\b/u.test(text);
  const hasClass = /\b(class list|class record|course code|course title)\b/u.test(text);
  const structural = options.candidates.some((candidate) => candidate.isStructuralHeader);
  let documentType: ImportDocumentType = "UNKNOWN_TABULAR_DOCUMENT";
  const evidence: string[] = [];

  if (hasGrade && structural) {
    documentType = "CLASS_GRADE_RECORD";
    evidence.push("Grade-component labels and a structural roster header were found");
  } else if (hasAttendance && structural) {
    documentType = "ATTENDANCE_OR_RECORD_SHEET";
    evidence.push("Attendance labels and a structural roster header were found");
  } else if (hasStudent && hasFaculty && titleMasterlist) {
    documentType = "MIXED_MASTERLIST";
    evidence.push("Student and faculty language appears in the same masterlist");
  } else if (titleMasterlist && hasFaculty) {
    documentType = "FACULTY_MASTERLIST";
    evidence.push("Faculty masterlist title or labels were found");
  } else if (titleMasterlist && hasStudent) {
    documentType = "STUDENT_MASTERLIST";
    evidence.push("Student masterlist title or labels were found");
  } else if (hasClass || (hasStudent && structural)) {
    documentType = "CLASS_LIST";
    evidence.push("Class context and a student roster structure were found");
  } else if (options.selectedHeader?.qualifies) {
    documentType = options.importType === "FACULTY" ? "FACULTY_MASTERLIST" : "STUDENT_MASTERLIST";
    evidence.push("A complete role-specific import header was found");
  } else if (structural) {
    evidence.push("A tabular header was found, but its purpose is not conclusive");
  } else {
    evidence.push("No reliable import or roster structure was found");
  }

  const mismatch =
    options.importType === "FACULTY" && ["STUDENT_MASTERLIST", "CLASS_LIST", "CLASS_GRADE_RECORD", "ATTENDANCE_OR_RECORD_SHEET"].includes(documentType)
      ? "This document appears student-oriented, but Faculty import is selected."
      : options.importType === "STUDENT_FARMER" && documentType === "FACULTY_MASTERLIST"
        ? "This document appears faculty-oriented, but Student import is selected."
        : documentType === "MIXED_MASTERLIST"
          ? "This sheet appears to contain mixed roles. H-Auto will not split roles automatically."
          : null;

  const status: ImportUserStatus = options.mappingReady
    ? "READY"
    : options.needsReview || (!structural && documentType === "UNKNOWN_TABULAR_DOCUMENT")
      ? "NEEDS_REVIEW"
      : "MISSING_REQUIRED_INFORMATION";
  return {
    documentType,
    status,
    confidence: documentType === "UNKNOWN_TABULAR_DOCUMENT" ? "LOW" : structural ? "HIGH" : "MEDIUM",
    evidence,
    importTypeWarning: mismatch,
  };
}
