"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { commitImportRows } from "@/lib/imports/commit";
import {
  preflightImportRows,
  type ServerImportRow,
} from "@/lib/imports/preflight";
import { MAX_IMPORT_DATA_ROWS } from "@/lib/imports/masterlist-mapping";

function parseServerRows(value: unknown): ServerImportRow[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_IMPORT_DATA_ROWS) return null;
  const rows: ServerImportRow[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return null;
    const row = candidate as Record<string, unknown>;
    if (!row.raw || typeof row.raw !== "object" || Array.isArray(row.raw)) {
      return null;
    }
    if (!Number.isInteger(row.rowNumber) || Number(row.rowNumber) < 1) {
      return null;
    }
    if (
      row.parsingErrors !== undefined &&
      (!Array.isArray(row.parsingErrors) ||
        row.parsingErrors.some((message) => typeof message !== "string"))
    ) {
      return null;
    }
    rows.push({
      rowNumber: Number(row.rowNumber),
      raw: row.raw as Record<string, unknown>,
      ...(Array.isArray(row.parsingErrors)
        ? { parsingErrors: row.parsingErrors as string[] }
        : {}),
    });
  }
  return rows;
}

export async function preflightImport(type: unknown, value: unknown) {
  await requireAdmin();
  const rows = parseServerRows(value);
  if (!rows) return { error: "Invalid import rows." };

  const result = await preflightImportRows(type, rows);
  if ("error" in result) return result;
  return {
    ...result,
    rows: result.rows.map((row) => ({
      rowNumber: row.rowNumber,
      raw: row.raw,
      eligible: row.eligible,
      issues: row.issues,
    })),
  };
}

export async function commitImport(
  type: unknown,
  value: unknown,
  fileNameValue: unknown
) {
  const session = await requireAdmin();
  const rows = parseServerRows(value);
  if (!rows) return { error: "Invalid import rows." };
  if (typeof fileNameValue !== "string" || fileNameValue.length > 255) {
    return { error: "Invalid file name." };
  }

  const result = await commitImportRows({
    rows,
    importType: type,
    actorId: session.user.id,
    fileName: fileNameValue,
  });
  if ("error" in result) return result;

  revalidatePath("/dashboard/users");
  return {
    success: result.created,
    credentials: result.credentials,
    failed: result.failed,
    totalProcessed: result.totalProcessed,
  };
}
