import type { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhPhone } from "@/lib/sms/phone";
import {
  MAX_IMPORT_DATA_ROWS,
} from "@/lib/imports/masterlist-mapping";
import { formatZodIssue, normalizeImportRow } from "@/lib/imports/parse-rows";
import {
  facultyImportRowSchema,
  parseImportType,
  studentImportRowSchema,
  type FacultyImportRow,
  type StudentImportRow,
} from "@/lib/validations/import";
import type { ImportRowType } from "@/lib/constants/user-import";

export type ImportIssueCode =
  | "PARSING_ERROR"
  | "MISSING_REQUIRED"
  | "INVALID_EMAIL"
  | "INVALID_ID"
  | "INVALID_PHONE"
  | "INVALID_DEPARTMENT"
  | "INVALID_POSITION"
  | "INVALID_COURSE"
  | "INVALID_YEAR_LEVEL"
  | "INVALID_SECTION"
  | "INVALID_ACADEMIC_YEAR"
  | "INVALID_FIELD_LENGTH"
  | "COURSE_SECTION_MISMATCH"
  | "YEAR_SECTION_MISMATCH"
  | "ID_ACADEMIC_YEAR_MISMATCH"
  | "COHORT_YEAR_LEVEL_MISMATCH"
  | "COHORT_SECTION_YEAR_MISMATCH"
  | "COHORT_OUT_OF_RANGE"
  | "DUPLICATE_EMAIL_FILE"
  | "DUPLICATE_ID_FILE"
  | "DUPLICATE_PHONE_FILE"
  | "EMAIL_EXISTS"
  | "ID_EXISTS"
  | "PHONE_EXISTS";

export type ImportIssue = {
  field?: string;
  code: ImportIssueCode;
  message: string;
};

export type ServerImportRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  parsingErrors?: readonly string[];
};

export type ValidatedImportRow = FacultyImportRow | StudentImportRow;

export type PreflightRow = {
  rowNumber: number;
  raw: Record<string, string>;
  eligible: boolean;
  issues: ImportIssue[];
  validated: ValidatedImportRow | null;
};

export type PreflightResult = {
  importType: ImportRowType;
  rows: PreflightRow[];
  totalRows: number;
  eligibleRows: number;
  excludedRows: number;
};

export type PreflightFailure = { error: string };

export type ExistingUserIdentity = {
  email: string;
  idNumber: string | null;
  phoneNumber: string | null;
};

export type ExistingIdentityCriteria = {
  emails: string[];
  idNumbers: string[];
  phoneNumbers: string[];
};

export type ExistingIdentityLookup = (
  criteria: ExistingIdentityCriteria
) => Promise<ExistingUserIdentity[]>;

const ALLOWED_PARSING_ERRORS = new Set([
  "Formula cells are not supported for imported user fields.",
  "Excel error cells are not supported for imported user fields.",
]);

const FIELD_CODES: Record<string, ImportIssueCode> = {
  email: "INVALID_EMAIL",
  idNumber: "INVALID_ID",
  phoneNumber: "INVALID_PHONE",
  department: "INVALID_DEPARTMENT",
  position: "INVALID_POSITION",
  course: "INVALID_COURSE",
  yearLevel: "INVALID_YEAR_LEVEL",
  section: "INVALID_SECTION",
  academicYear: "INVALID_ACADEMIC_YEAR",
};

function zodIssueToImportIssue(
  issue: ZodError["issues"][number]
): ImportIssue {
  const field = issue.path.join(".") || undefined;
  const customCode =
    issue.code === "custom" &&
    "params" in issue &&
    typeof issue.params?.importIssueCode === "string"
      ? (issue.params.importIssueCode as ImportIssueCode)
      : undefined;
  const code = issue.message.includes("at most 255 characters")
    ? "INVALID_FIELD_LENGTH"
    : issue.message.toLowerCase().includes("required")
      ? "MISSING_REQUIRED"
      : customCode ?? (field ? FIELD_CODES[field] : undefined) ?? "INVALID_FIELD_LENGTH";
  return {
    ...(field ? { field } : {}),
    code,
    message: formatZodIssue(issue),
  };
}

function addIssue(row: PreflightRow, issue: ImportIssue): void {
  if (
    !row.issues.some(
      (current) =>
        current.code === issue.code &&
        current.field === issue.field &&
        current.message === issue.message
    )
  ) {
    row.issues.push(issue);
  }
}

export function normalizedPhoneKey(value: string | null | undefined): string | null {
  return normalizePhPhone(value);
}

export function normalizedIdKey(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function serializeMobilePreflightRow(row: PreflightRow) {
  return {
    rowNumber: row.rowNumber,
    raw: row.raw,
    errors: row.issues.map((issue) => issue.message),
    eligible: row.eligible,
    issues: row.issues,
  };
}

export function phoneStorageVariants(phoneKey: string): string[] {
  if (!/^639\d{9}$/.test(phoneKey)) return [phoneKey];
  return [phoneKey, `+${phoneKey}`, `0${phoneKey.slice(2)}`, phoneKey.slice(2)];
}

function countBy(rows: PreflightRow[], select: (row: PreflightRow) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = select(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function analyzeImportRows(
  importTypeValue: unknown,
  inputRows: readonly ServerImportRow[]
): PreflightResult | PreflightFailure {
  const importType = parseImportType(importTypeValue);
  if (!importType) {
    return { error: "Import type must be FACULTY or STUDENT_FARMER." };
  }
  if (inputRows.length === 0) return { error: "No rows to validate." };
  if (inputRows.length > MAX_IMPORT_DATA_ROWS) {
    return { error: `Files with more than ${MAX_IMPORT_DATA_ROWS} data rows are not supported.` };
  }
  if (
    inputRows.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        !row.raw ||
        typeof row.raw !== "object" ||
        Array.isArray(row.raw)
    )
  ) {
    return { error: "Invalid import rows." };
  }

  const schema = importType === "FACULTY" ? facultyImportRowSchema : studentImportRowSchema;
  const rows: PreflightRow[] = inputRows.map((input, index) => {
    const raw = normalizeImportRow(input.raw, importType);
    const parsed = schema.safeParse(raw);
    const row: PreflightRow = {
      rowNumber:
        Number.isInteger(input.rowNumber) && input.rowNumber > 0
          ? input.rowNumber
          : index + 2,
      raw,
      eligible: false,
      issues: (input.parsingErrors ?? [])
        .filter((message) => ALLOWED_PARSING_ERRORS.has(message))
        .map((message) => ({
          code: "PARSING_ERROR" as const,
          message,
        })),
      validated: parsed.success ? parsed.data : null,
    };
    if (!parsed.success) {
      for (const issue of parsed.error.issues) addIssue(row, zodIssueToImportIssue(issue));
    }
    return row;
  });

  const emailCounts = countBy(rows, (row) => row.raw.email.toLowerCase());
  const idCounts = countBy(rows, (row) => normalizedIdKey(row.raw.idNumber) ?? "");
  const phoneCounts = countBy(rows, (row) => normalizedPhoneKey(row.raw.phoneNumber) ?? "");

  for (const row of rows) {
    const email = row.raw.email.toLowerCase();
    if (email && (emailCounts.get(email) ?? 0) > 1) {
      addIssue(row, {
        field: "email",
        code: "DUPLICATE_EMAIL_FILE",
        message: "Duplicate email within this file.",
      });
    }
    const idNumber = normalizedIdKey(row.raw.idNumber);
    if (idNumber && (idCounts.get(idNumber) ?? 0) > 1) {
      addIssue(row, {
        field: "idNumber",
        code: "DUPLICATE_ID_FILE",
        message: "Duplicate ID number within this file.",
      });
    }
    const phone = normalizedPhoneKey(row.raw.phoneNumber);
    if (phone && (phoneCounts.get(phone) ?? 0) > 1) {
      addIssue(row, {
        field: "phoneNumber",
        code: "DUPLICATE_PHONE_FILE",
        message: "Duplicate phone number within this file.",
      });
    }
    row.eligible = row.issues.length === 0;
  }

  const eligibleRows = rows.filter((row) => row.eligible).length;
  return {
    importType,
    rows,
    totalRows: rows.length,
    eligibleRows,
    excludedRows: rows.length - eligibleRows,
  };
}

export function applyExistingUserConflicts(
  result: PreflightResult,
  existing: readonly ExistingUserIdentity[]
): PreflightResult {
  const existingEmails = new Set(existing.map((user) => user.email.trim().toLowerCase()));
  const existingIds = new Set(
    existing
      .map((user) => normalizedIdKey(user.idNumber))
      .filter((value): value is string => !!value)
  );
  const existingPhones = new Set(
    existing
      .map((user) => normalizedPhoneKey(user.phoneNumber))
      .filter((value): value is string => !!value)
  );

  for (const row of result.rows) {
    if (existingEmails.has(row.raw.email.toLowerCase())) {
      addIssue(row, {
        field: "email",
        code: "EMAIL_EXISTS",
        message: "Email already exists.",
      });
    }
    const idNumber = normalizedIdKey(row.raw.idNumber);
    if (idNumber && existingIds.has(idNumber)) {
      addIssue(row, {
        field: "idNumber",
        code: "ID_EXISTS",
        message: "ID Number already exists.",
      });
    }
    const phone = normalizedPhoneKey(row.raw.phoneNumber);
    if (phone && existingPhones.has(phone)) {
      addIssue(row, {
        field: "phoneNumber",
        code: "PHONE_EXISTS",
        message: "Phone number already exists.",
      });
    }
    row.eligible = row.issues.length === 0;
  }

  const eligibleRows = result.rows.filter((row) => row.eligible).length;
  return {
    ...result,
    eligibleRows,
    excludedRows: result.totalRows - eligibleRows,
  };
}

export function buildExistingIdentityQuery({
  emails,
  idNumbers,
  phoneNumbers,
}: ExistingIdentityCriteria): Prisma.Sql | null {
  if (emails.length === 0 && idNumbers.length === 0 && phoneNumbers.length === 0) {
    return null;
  }
  const clauses: Prisma.Sql[] = [];
  if (emails.length > 0) {
    clauses.push(Prisma.sql`LOWER("email") IN (${Prisma.join(emails)})`);
  }
  if (idNumbers.length > 0) {
    clauses.push(Prisma.sql`BTRIM("idNumber") IN (${Prisma.join(idNumbers)})`);
  }
  if (phoneNumbers.length > 0) {
    const localPhoneNumbers = phoneNumbers.map((phone) => phone.slice(2));
    clauses.push(
      Prisma.sql`(
        BTRIM(COALESCE("phoneNumber", '')) ~ '^[+]?[0-9[:space:]().-]+$'
        AND phone_digits ~ '^(09[0-9]{9}|63[0-9]{10}|9[0-9]{9})$'
        AND RIGHT(phone_digits, 10) IN (${Prisma.join(localPhoneNumbers)})
      )`
    );
  }

  // Parameterized PostgreSQL query: LOWER handles legacy mixed-case emails;
  // phone_digits lets the existing shared Philippine normalizer compare the
  // repository's accepted 09 / +639 / 639 / formatted storage variants in
  // one bounded query, without an N+1 loop or schema migration.
  return Prisma.sql`
    SELECT "email", "idNumber", "phoneNumber"
    FROM (
      SELECT
        "email",
        "idNumber",
        "phoneNumber",
        regexp_replace(COALESCE("phoneNumber", ''), '[^0-9]', '', 'g') AS phone_digits
      FROM "User"
    ) AS identities
    WHERE ${Prisma.join(clauses, " OR ")}
  `;
}

const prismaExistingIdentityLookup: ExistingIdentityLookup = async (criteria) => {
  const query = buildExistingIdentityQuery(criteria);
  return query ? prisma.$queryRaw<ExistingUserIdentity[]>(query) : [];
};

export async function preflightImportRows(
  importTypeValue: unknown,
  inputRows: readonly ServerImportRow[],
  lookup: ExistingIdentityLookup = prismaExistingIdentityLookup
): Promise<PreflightResult | PreflightFailure> {
  const result = analyzeImportRows(importTypeValue, inputRows);
  if ("error" in result) return result;

  const emails = [...new Set(result.rows.map((row) => row.raw.email.toLowerCase()).filter(Boolean))];
  const idNumbers = [
    ...new Set(
      result.rows
        .map((row) => normalizedIdKey(row.raw.idNumber))
        .filter((value): value is string => !!value)
    ),
  ];
  const phoneNumbers = [
    ...new Set(
      result.rows
        .map((row) => normalizedPhoneKey(row.raw.phoneNumber))
        .filter((value): value is string => !!value)
    ),
  ];
  try {
    const existing = await lookup({ emails, idNumbers, phoneNumbers });
    return applyExistingUserConflicts(result, existing);
  } catch (error) {
    console.error("[preflightImportRows] duplicate lookup failed:", error);
    return { error: "Could not check existing users. Please try again." };
  }
}
