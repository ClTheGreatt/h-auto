import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { parseExcelImportFile } from "@/lib/imports/parse-excel";
import type { ImportRowType } from "@/lib/validations/import";

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

  if (type !== "FACULTY" && type !== "STUDENT_FARMER") {
    return NextResponse.json(
      { error: "type must be FACULTY or STUDENT_FARMER" },
      { status: 400 }
    );
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const result = await parseExcelImportFile(buffer, type as ImportRowType);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ rows: result.rows });
}
