import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { buildParsedRows } from "@/lib/imports/parse-rows";
import type { ImportRowType } from "@/lib/validations/import";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// POST /api/mobile/me/users/import/validate — dry-run validation for the
// mobile import preview (admin only). Runs the exact same schemas as the
// commit route (/api/mobile/me/users/import), via the same buildParsedRows
// the web preview uses — no duplicated rules. Never persists anything and
// never checks DB-existing email/idNumber conflicts, matching the web
// preview's scope (that check only happens at commit time).
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

  const type = body.type as ImportRowType;
  if (type !== "FACULTY" && type !== "STUDENT_FARMER") {
    return NextResponse.json(
      { error: "type must be FACULTY or STUDENT_FARMER" },
      { status: 400 }
    );
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to validate" }, { status: 400 });
  }

  const parsed = buildParsedRows(rows, type);
  return NextResponse.json({ rows: parsed });
}
