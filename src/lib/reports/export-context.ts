import type { UserRole } from "@prisma/client";
import { formatDateTime } from "@/lib/format-date";

export type StoredExporterIdentity = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  role: UserRole;
  section: string | null;
};

export type ReportExportContext = {
  generatedAt: Date;
  exporter: {
    fullName: string;
    role: string;
    section?: string;
  };
};

const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT_FARMER: "Student Farmer",
  FACULTY: "Faculty",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super Administrator",
};

export function buildReportExportContext(
  identity: StoredExporterIdentity,
  generatedAt: Date
): ReportExportContext {
  const fullName = [
    identity.firstName,
    identity.middleName,
    identity.lastName,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (!fullName) throw new Error("Exporter name is unavailable");

  const section =
    identity.role === "STUDENT_FARMER"
      ? identity.section?.trim() || undefined
      : undefined;

  return {
    generatedAt,
    exporter: {
      fullName,
      role: ROLE_LABELS[identity.role],
      ...(section ? { section } : {}),
    },
  };
}

export function getReportExportMetadata(context: ReportExportContext) {
  return [
    { label: "Generated", value: formatDateTime(context.generatedAt) },
    {
      label: "Exported by",
      value: `${context.exporter.fullName} · ${context.exporter.role}`,
    },
    ...(context.exporter.section
      ? [{ label: "Section", value: context.exporter.section }]
      : []),
  ];
}
