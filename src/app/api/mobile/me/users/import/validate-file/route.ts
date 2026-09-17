import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { parseExcelImportFile } from "@/lib/imports/parse-excel";
import { mapSourceRows } from "@/lib/imports/masterlist-mapping";
import {
  preflightImportRows,
  serializeMobilePreflightRow,
} from "@/lib/imports/preflight";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants/user-import";
import { parseImportType } from "@/lib/validations/import";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// POST /api/mobile/me/users/import/validate-file — dry-run validation for
// an uploaded .xlsx file (admin only). Mirrors /api/users/import/parse on
// the web side; both call the same parseExcelImportFile so the marker
// check, header-asterisk strip, and row validation never drift apart.
// Never persists anything.
export async function POST(req: NextRequest) {
  const actor = await getMobileUser(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  const importType = parseImportType(type);
  if (!importType) {
    return NextResponse.json(
      { error: "type must be FACULTY or STUDENT_FARMER" },
      { status: 400 }
    );
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum upload size is 4 MB." },
      { status: 413 }
    );
  }

  const buffer = await file.arrayBuffer();
  const result = await parseExcelImportFile(buffer, importType);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Batch 1 adds manual sheet/header/column mapping to the web importer.
  // The mobile UI has no mapping screen, so keep its existing contract
  // truthful: auto-mapped files work; files needing intervention are sent to
  // the web dashboard instead of returning a nullable `rows` payload.
  if (!result.rows) {
    return NextResponse.json(
      {
        error:
          "This workbook needs sheet or column mapping. Use the web dashboard to review it, or upload an H-Auto template.",
      },
      { status: 400 }
    );
  }

  const mappedRows = result.analysis ? mapSourceRows(result.analysis) : [];
  const preflight = await preflightImportRows(
    importType,
    mappedRows.map((row) => ({
      rowNumber: row.rowNumber,
      raw: row.raw,
      parsingErrors: row.parsingErrors,
    }))
  );
  if ("error" in preflight) {
    return NextResponse.json({ error: preflight.error }, { status: 400 });
  }
  return NextResponse.json({
    ...preflight,
    rows: preflight.rows.map(serializeMobilePreflightRow),
  });
}
