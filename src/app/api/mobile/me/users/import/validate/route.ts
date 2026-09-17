import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import {
  preflightImportRows,
  serializeMobilePreflightRow,
} from "@/lib/imports/preflight";
import { parseImportType } from "@/lib/validations/import";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// POST /api/mobile/me/users/import/validate — dry-run validation for the
// mobile import preview (admin only). Uses the same authoritative preflight
// as web preview and final commit, including batched database conflicts.
// Never persists anything.
export async function POST(req: NextRequest) {
  const actor = await getMobileUser(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { type?: string; rows?: Record<string, unknown>[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const type = parseImportType(body.type);
  if (!type) {
    return NextResponse.json(
      { error: "type must be FACULTY or STUDENT_FARMER" },
      { status: 400 }
    );
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to validate" }, { status: 400 });
  }

  const result = await preflightImportRows(
    type,
    rows.map((raw, index) => ({ rowNumber: index + 2, raw }))
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ...result,
    rows: result.rows.map(serializeMobilePreflightRow),
  });
}
