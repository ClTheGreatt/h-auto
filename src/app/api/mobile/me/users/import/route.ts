import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { commitImportRows } from "@/lib/imports/commit";
import { parseImportType } from "@/lib/validations/import";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

type RawRow = Record<string, unknown>;

// POST /api/mobile/me/users/import — bulk create from parsed CSV rows (admin only)
export async function POST(req: NextRequest) {
  const actor = await getMobileUser(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { type?: string; rows?: RawRow[]; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const type = parseImportType(body.type);
  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  const fileName =
    typeof body.fileName === "string" ? body.fileName : "import.csv";

  if (!type) {
    return NextResponse.json(
      { error: "type must be FACULTY or STUDENT_FARMER" },
      { status: 400 }
    );
  }
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (fileName.length > 255) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const result = await commitImportRows({
    rows: rawRows.map((raw, index) => ({ rowNumber: index + 2, raw })),
    importType: type,
    actorId: actor.id,
    fileName,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { created, credentials, failed, totalProcessed } = result;

  return NextResponse.json({
    success: created,
    credentials,
    failed,
    totalProcessed,
  });
}
