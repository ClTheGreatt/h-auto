import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import {
  MAX_IMPORT_FILE_BYTES,
  validateStudentAcademicFields,
} from "@/lib/constants/user-import";
import {
  createStudentWebSchema,
  updateUserSchema,
} from "@/lib/validations/user";
import { parseImportType } from "@/lib/validations/import";
import { parseExcelImportFile } from "@/lib/imports/parse-excel";
import {
  analyzeImportRows,
  buildExistingIdentityQuery,
  normalizedIdKey,
  normalizedPhoneKey,
  phoneStorageVariants,
  preflightImportRows,
  serializeMobilePreflightRow,
  type ImportIssueCode,
  type ServerImportRow,
} from "@/lib/imports/preflight";
import {
  buildImportAuditData,
  friendlyImportUniqueConflict,
} from "@/lib/imports/commit";
import { buildAutomaticColumns } from "@/lib/imports/masterlist-mapping";

const BSA = "BS Agriculture - Animal Science";
const BTVTED = "BTVTEd - Animal Production";
const BSABE = "BS Agricultural and Biosystems Engineering";

function student(seed = 1, overrides: Record<string, unknown> = {}) {
  return {
    firstName: `Student${seed}`,
    middleName: "",
    lastName: "Tester",
    email: `student${seed}@bpsu.edu.ph`,
    phoneNumber: `+63917${String(seed).padStart(7, "0")}`,
    idNumber: `23-${String(seed).padStart(5, "0")}`,
    academicYear: "2023-2024",
    course: BSA,
    yearLevel: "3rd Year",
    section: "BSA-3A",
    ...overrides,
  };
}

function faculty(seed = 1, overrides: Record<string, unknown> = {}) {
  return {
    firstName: `Faculty${seed}`,
    middleName: "",
    lastName: "Tester",
    email: `faculty${seed}@bpsu.edu.ph`,
    phoneNumber: `+63918${String(seed).padStart(7, "0")}`,
    idNumber: `${String(200000 + seed)}-${String(seed).padStart(4, "0")}`,
    department: BSA,
    position: "Instructor I",
    ...overrides,
  };
}

function input(raw: Record<string, unknown>, rowNumber = 2): ServerImportRow {
  return { rowNumber, raw };
}

function resultFor(
  type: unknown,
  rows: ServerImportRow[]
) {
  const result = analyzeImportRows(type, rows);
  assert.ok(!("error" in result), "expected successful analysis");
  return result;
}

function hasCode(
  result: ReturnType<typeof resultFor>,
  code: ImportIssueCode,
  row = 0
) {
  return result.rows[row].issues.some((issue) => issue.code === code);
}

test("runtime import type accepts FACULTY", () => {
  assert.equal(parseImportType("FACULTY"), "FACULTY");
});

test("runtime import type accepts STUDENT_FARMER", () => {
  assert.equal(parseImportType("STUDENT_FARMER"), "STUDENT_FARMER");
});

test("runtime import type rejects ADMIN", () => {
  assert.equal(parseImportType("ADMIN"), null);
});

test("runtime import type rejects SUPER_ADMIN", () => {
  assert.equal(parseImportType("SUPER_ADMIN"), null);
});

test("runtime import type rejects arbitrary and missing values", () => {
  assert.equal(parseImportType("student"), null);
  assert.equal(parseImportType(undefined), null);
});

test("canonical BSA course, prefix, and year are valid", () => {
  assert.deepEqual(
    validateStudentAcademicFields({
      course: BSA,
      yearLevel: "3rd Year",
      section: "BSA-3D",
    }),
    []
  );
});

test("canonical BTVTEd course, prefix, and year are valid", () => {
  assert.deepEqual(
    validateStudentAcademicFields({
      course: BTVTED,
      yearLevel: "2nd Year",
      section: "BTVTED-2B",
    }),
    []
  );
});

test("canonical BSABE fifth year is valid", () => {
  assert.deepEqual(
    validateStudentAcademicFields({
      course: BSABE,
      yearLevel: "5th Year",
      section: "BSABE-5A",
    }),
    []
  );
});

test("four-year BSA course rejects fifth year", () => {
  const issues = validateStudentAcademicFields({
    course: BSA,
    yearLevel: "5th Year",
    section: "BSA-5A",
  });
  assert.ok(issues.some((issue) => issue.code === "INVALID_YEAR_LEVEL"));
});

test("four-year BTVTEd course rejects fifth year", () => {
  const issues = validateStudentAcademicFields({
    course: BTVTED,
    yearLevel: "5th Year",
    section: "BTVTED-5A",
  });
  assert.ok(issues.some((issue) => issue.code === "INVALID_YEAR_LEVEL"));
});

test("course and section prefix mismatch is rejected", () => {
  const issues = validateStudentAcademicFields({
    course: BSA,
    yearLevel: "3rd Year",
    section: "BTVTED-3A",
  });
  assert.ok(issues.some((issue) => issue.code === "COURSE_SECTION_MISMATCH"));
});

test("year level and section year mismatch is rejected", () => {
  const issues = validateStudentAcademicFields({
    course: BSA,
    yearLevel: "2nd Year",
    section: "BSA-3D",
  });
  assert.ok(issues.some((issue) => issue.code === "YEAR_SECTION_MISMATCH"));
});

test("Student import requires yearLevel", () => {
  const result = resultFor("STUDENT_FARMER", [input(student(1, { yearLevel: "" }))]);
  assert.ok(hasCode(result, "MISSING_REQUIRED"));
});

test("Faculty department remains canonical", () => {
  const result = resultFor("FACULTY", [input(faculty(1, { department: "Agriculture" }))]);
  assert.ok(hasCode(result, "INVALID_DEPARTMENT"));
});

test("academic year 2023-2024 is valid", () => {
  assert.equal(resultFor("STUDENT_FARMER", [input(student())]).rows[0].eligible, true);
});

test("academic year 2026-2027 is valid", () => {
  const result = resultFor("STUDENT_FARMER", [input(student(1, { academicYear: "2026-2027" }))]);
  assert.equal(result.rows[0].eligible, true);
});

for (const academicYear of ["2023-2025", "23-24", "2026/2027"]) {
  test(`academic year ${academicYear} is rejected`, () => {
    const result = resultFor("STUDENT_FARMER", [input(student(1, { academicYear }))]);
    assert.ok(hasCode(result, "INVALID_ACADEMIC_YEAR"));
  });
}

test("blank academic year keeps Student ID derivation", () => {
  const result = resultFor("STUDENT_FARMER", [input(student(1, { academicYear: "" }))]);
  assert.equal(result.rows[0].raw.academicYear, "2023-2024");
  assert.equal(result.rows[0].eligible, true);
});

test("generic academic-year headers remain deliberately unmapped", () => {
  const columns = buildAutomaticColumns(
    ["AY", "A.Y.", "School Year"],
    "STUDENT_FARMER"
  );
  assert.ok(columns.every((column) => column.mappedField === null));
});

test("imported email is trimmed and lowercased", () => {
  const result = resultFor("STUDENT_FARMER", [
    input(student(1, { email: "  Student1@BPSU.EDU.PH " })),
  ]);
  assert.equal(result.rows[0].raw.email, "student1@bpsu.edu.ph");
});

test("case-variant email duplicates mark every conflicting row", () => {
  const result = resultFor("STUDENT_FARMER", [
    input(student(1), 2),
    input(student(2, { email: "STUDENT1@BPSU.EDU.PH" }), 3),
  ]);
  assert.ok(result.rows.every((row) => row.issues.some((issue) => issue.code === "DUPLICATE_EMAIL_FILE")));
});

test("same-file ID duplicates mark every conflicting row", () => {
  const result = resultFor("STUDENT_FARMER", [
    input(student(1), 2),
    input(student(2, { idNumber: "23-00001" }), 3),
  ]);
  assert.ok(result.rows.every((row) => row.issues.some((issue) => issue.code === "DUPLICATE_ID_FILE")));
});

test("same-file normalized phone duplicates mark every conflicting row", () => {
  const result = resultFor("STUDENT_FARMER", [
    input(student(1), 2),
    input(student(2, { phoneNumber: "+639170000001" }), 3),
  ]);
  assert.ok(result.rows.every((row) => row.issues.some((issue) => issue.code === "DUPLICATE_PHONE_FILE")));
});

test("blank phones do not conflict", () => {
  const result = resultFor("STUDENT_FARMER", [
    input(student(1, { phoneNumber: "" }), 2),
    input(student(2, { phoneNumber: "" }), 3),
  ]);
  assert.ok(result.rows.every((row) => !row.issues.some((issue) => issue.code === "DUPLICATE_PHONE_FILE")));
});

test("phone comparison reuses Philippine normalization", () => {
  assert.equal(normalizedPhoneKey("09170000001"), "639170000001");
  assert.equal(normalizedPhoneKey("+639170000001"), "639170000001");
  assert.ok(phoneStorageVariants("639170000001").includes("09170000001"));
});

test("phone normalization accepts supported compact and formatted values", () => {
  for (const value of [
    "09171234567",
    "+639171234567",
    "639171234567",
    "9171234567",
    "0917 123 4567",
    "+63 917 123 4567",
    "0917-123-4567",
    "(0917) 123 4567",
  ]) {
    assert.equal(normalizedPhoneKey(value), "639171234567");
  }
});

test("phone normalization rejects alphabetic garbage", () => {
  for (const value of [
    "abc09171234567",
    "09171234567xyz",
    "phone:09171234567",
    "0917ABC4567",
  ]) {
    assert.equal(normalizedPhoneKey(value), null);
  }
  assert.equal(normalizedPhoneKey(""), null);
  assert.equal(normalizedPhoneKey(null), null);
});

test("batched DB preflight catches mixed-case email and runs one lookup", async () => {
  let calls = 0;
  const result = await preflightImportRows(
    "STUDENT_FARMER",
    [input(student(1)), input(student(2), 3)],
    async (criteria) => {
      calls += 1;
      assert.ok(criteria.emails.includes("student1@bpsu.edu.ph"));
      return [{ email: "Student1@BPSU.edu.ph", idNumber: null, phoneNumber: null }];
    }
  );
  assert.ok(!("error" in result));
  assert.equal(calls, 1);
  assert.ok(hasCode(result, "EMAIL_EXISTS"));
  assert.equal(result.rows[1].eligible, true);
});

test("DB preflight catches existing ID", async () => {
  const result = await preflightImportRows("STUDENT_FARMER", [input(student(1))], async () => [
    { email: "other@bpsu.edu.ph", idNumber: "23-00001", phoneNumber: null },
  ]);
  assert.ok(!("error" in result));
  assert.ok(hasCode(result, "ID_EXISTS"));
});

test("DB preflight catches an existing whitespace-padded ID", async () => {
  const result = await preflightImportRows(
    "STUDENT_FARMER",
    [input(student(1))],
    async () => [
      {
        email: "other@bpsu.edu.ph",
        idNumber: " 23-00001 ",
        phoneNumber: null,
      },
    ]
  );
  assert.ok(!("error" in result));
  assert.ok(hasCode(result, "ID_EXISTS"));
});

test("blank and unrelated existing IDs do not create false conflicts", async () => {
  const result = await preflightImportRows(
    "STUDENT_FARMER",
    [input(student(1))],
    async () => [
      { email: "blank@bpsu.edu.ph", idNumber: null, phoneNumber: null },
      { email: "other@bpsu.edu.ph", idNumber: "23-99999", phoneNumber: null },
    ]
  );
  assert.ok(!("error" in result));
  assert.equal(result.rows[0].eligible, true);
});

test("ID lookup SQL trims stored values and keeps candidates parameterized", () => {
  assert.equal(normalizedIdKey(" 23-12345 "), "23-12345");
  assert.equal(normalizedIdKey("   "), null);
  const query = buildExistingIdentityQuery({
    emails: [],
    idNumbers: ["23-12345"],
    phoneNumbers: [],
  });
  assert.ok(query);
  assert.match(query.sql, /BTRIM\("idNumber"\) IN/);
  assert.equal(query.sql.includes("23-12345"), false);
  assert.deepEqual(query.values, ["23-12345"]);
});

test("DB preflight catches equivalent existing phone", async () => {
  const result = await preflightImportRows("STUDENT_FARMER", [input(student(1))], async () => [
    { email: "other@bpsu.edu.ph", idNumber: null, phoneNumber: "09170000001" },
  ]);
  assert.ok(!("error" in result));
  assert.ok(hasCode(result, "PHONE_EXISTS"));
});

test("preview-to-commit race is caught by repeated authoritative preflight", async () => {
  let occupied = false;
  const lookup = async () =>
    occupied
      ? [{ email: "student1@bpsu.edu.ph", idNumber: null, phoneNumber: null }]
      : [];
  const rows = [input(student(1)), input(student(2), 3)];
  const preview = await preflightImportRows("STUDENT_FARMER", rows, lookup);
  assert.ok(!("error" in preview));
  assert.equal(preview.eligibleRows, 2);
  occupied = true;
  const final = await preflightImportRows("STUDENT_FARMER", rows, lookup);
  assert.ok(!("error" in final));
  assert.equal(final.rows[0].eligible, false);
  assert.equal(final.rows[1].eligible, true);
});

test("friendly P2002 messages never expose Prisma internals", () => {
  for (const [field, expected] of [
    ["email", "Email already exists."],
    ["idNumber", "ID Number already exists."],
    ["phoneNumber", "Phone number already exists."],
    ["unknown", "A user with one of these unique account details already exists."],
  ] as const) {
    const error = new Prisma.PrismaClientKnownRequestError("private", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: [field] },
    });
    assert.equal(friendlyImportUniqueConflict(error), expected);
  }
});

test("audit data counts the full request and keeps only safe failure details", () => {
  const failureWithSensitiveExtras = {
    rowNumber: 3,
    email: "student2@bpsu.edu.ph",
    reason: "Email already exists.",
    tempPassword: "must-not-leak",
    ignoredNotes: "must-not-leak",
  };
  const audit = buildImportAuditData({
    actorId: "admin-1",
    importType: "STUDENT_FARMER",
    fileName: "students.xlsx",
    totalRows: 2,
    successCount: 1,
    failed: [failureWithSensitiveExtras],
  });
  assert.equal(audit.totalRows, 2);
  assert.equal(audit.successCount, 1);
  assert.equal(audit.failureCount, 1);
  assert.equal(audit.status, "COMPLETED_WITH_ERRORS");
  assert.deepEqual(audit.errorLog, [
    {
      rowNumber: 3,
      email: "student2@bpsu.edu.ph",
      reason: "Email already exists.",
    },
  ]);
});

test("mapped values longer than 255 characters are rejected", () => {
  const result = resultFor("STUDENT_FARMER", [input(student(1, { firstName: "A".repeat(256) }))]);
  assert.ok(hasCode(result, "INVALID_FIELD_LENGTH"));
});

test("ignored long source fields never enter validation", () => {
  const result = resultFor("STUDENT_FARMER", [
    input({ ...student(1), ignoredNotes: "A".repeat(10_000) }),
  ]);
  assert.equal(result.rows[0].eligible, true);
  assert.equal("ignoredNotes" in result.rows[0].raw, false);
});

test("more than 250 server rows are rejected", () => {
  const rows = Array.from({ length: 251 }, (_, index) => input(student(index + 1), index + 2));
  const result = analyzeImportRows("STUDENT_FARMER", rows);
  assert.ok("error" in result);
});

test("formula and Excel error protections remain authoritative inputs", () => {
  for (const message of [
    "Formula cells are not supported for imported user fields.",
    "Excel error cells are not supported for imported user fields.",
  ]) {
    const result = resultFor("STUDENT_FARMER", [
      { ...input(student()), parsingErrors: [message] },
    ]);
    assert.ok(hasCode(result, "PARSING_ERROR"));
  }
});

test("untrusted arbitrary parsing-error text is not retained", () => {
  const result = resultFor("STUDENT_FARMER", [
    { ...input(student()), parsingErrors: ["password=secret"] },
  ]);
  assert.equal(result.rows[0].eligible, true);
  assert.equal(result.rows[0].issues.length, 0);
});

test("mobile preflight projection preserves old and new row fields", () => {
  const eligible = serializeMobilePreflightRow(
    resultFor("STUDENT_FARMER", [input(student(1), 5)]).rows[0]
  );
  assert.equal(eligible.rowNumber, 5);
  assert.equal(eligible.raw.email, "student1@bpsu.edu.ph");
  assert.equal(eligible.eligible, true);
  assert.deepEqual(eligible.errors, []);
  assert.deepEqual(eligible.issues, []);

  const invalid = serializeMobilePreflightRow(
    resultFor("STUDENT_FARMER", [
      input(student(1, { firstName: "" }), 7),
    ]).rows[0]
  );
  assert.equal(invalid.rowNumber, 7);
  assert.equal(invalid.eligible, false);
  assert.ok(invalid.errors.every((message) => typeof message === "string"));
  assert.ok(invalid.errors.some((message) => /firstName is required/i.test(message)));
  assert.ok(invalid.issues.some((issue) => issue.code === "MISSING_REQUIRED"));
});

test("Excel parser rejects a file over 4 MB before workbook parsing", async () => {
  const result = await parseExcelImportFile(
    new ArrayBuffer(MAX_IMPORT_FILE_BYTES + 1),
    "FACULTY"
  );
  assert.deepEqual(result, {
    error: "File is too large. Maximum upload size is 4 MB.",
  });
});

function webStudent(overrides: Record<string, unknown> = {}) {
  return {
    ...student(1),
    role: "STUDENT_FARMER",
    status: "ACTIVE",
    department: "",
    position: "",
    ...overrides,
  };
}

test("normal Add Student accepts BSABE fifth year", () => {
  const parsed = createStudentWebSchema.safeParse(
    webStudent({ course: BSABE, yearLevel: "5th Year", section: "BSABE-5A" })
  );
  assert.equal(parsed.success, true);
});

test("normal Add Student rejects wrong course/section prefix", () => {
  const parsed = createStudentWebSchema.safeParse(
    webStudent({ course: BSA, yearLevel: "3rd Year", section: "BTVTED-3A" })
  );
  assert.equal(parsed.success, false);
});

test("normal Edit Student rejects year/section mismatch", () => {
  const parsed = updateUserSchema.safeParse({
    ...webStudent({ yearLevel: "2nd Year", section: "BSA-3A" }),
    password: "",
  });
  assert.equal(parsed.success, false);
});
