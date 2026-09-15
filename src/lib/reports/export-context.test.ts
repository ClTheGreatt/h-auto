import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReportExportContext,
  getReportExportMetadata,
  type StoredExporterIdentity,
} from "./export-context";

const generatedAt = new Date("2026-09-15T10:30:00+08:00");

function identity(
  overrides: Partial<StoredExporterIdentity> = {}
): StoredExporterIdentity {
  return {
    firstName: "Juan",
    middleName: null,
    lastName: "Dela Cruz",
    role: "STUDENT_FARMER",
    section: " BSA-4D ",
    ...overrides,
  };
}

test("student exporter includes stored full name, friendly role, and nonempty section", () => {
  const context = buildReportExportContext(identity(), generatedAt);
  assert.deepEqual(context.exporter, {
    fullName: "Juan Dela Cruz",
    role: "Student Farmer",
    section: "BSA-4D",
  });
  assert.deepEqual(
    getReportExportMetadata(context).map((item) => item.label),
    ["Generated", "Exported by", "Section"]
  );
  assert.equal(
    getReportExportMetadata(context)[1]?.value,
    "Juan Dela Cruz · Student Farmer"
  );
  const withoutSection = buildReportExportContext(
    identity({ section: "  " }),
    generatedAt
  );
  assert.equal(withoutSection.exporter.section, undefined);
});

test("faculty omits section and invented honorifics", () => {
  const context = buildReportExportContext(
    identity({ role: "FACULTY", section: "BSA-4D" }),
    generatedAt
  );
  assert.deepEqual(context.exporter, {
    fullName: "Juan Dela Cruz",
    role: "Faculty",
  });
  assert.doesNotMatch(
    getReportExportMetadata(context)[1]?.value ?? "",
    /Prof\.|Dr\.|Engr\.|Faculty Adviser/
  );
});

test("admin roles use the canonical friendly labels", () => {
  assert.equal(
    buildReportExportContext(identity({ role: "ADMIN" }), generatedAt)
      .exporter.role,
    "Administrator"
  );
  assert.equal(
    buildReportExportContext(identity({ role: "SUPER_ADMIN" }), generatedAt)
      .exporter.role,
    "Super Administrator"
  );
});

test("stored middle names are included without doubled spaces", () => {
  assert.equal(
    buildReportExportContext(
      identity({ firstName: " Juan ", middleName: " M. ", lastName: " Dela Cruz " }),
      generatedAt
    ).exporter.fullName,
    "Juan M. Dela Cruz"
  );
  assert.equal(
    buildReportExportContext(identity({ middleName: null }), generatedAt)
      .exporter.fullName,
    "Juan Dela Cruz"
  );
});
