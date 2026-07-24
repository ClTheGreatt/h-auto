import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseExcelImportFile } from "@/lib/imports/parse-excel";
import type { ImportRowType } from "@/lib/validations/import";

export async function POST(req: NextRequest) {
  await requireAdmin();

  const formData = await req.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (type !== "faculty" && type !== "student") {
    return NextResponse.json(
      { error: "Invalid import type. Use type=faculty or type=student." },
      { status: 400 }
    );
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const importType: ImportRowType = type === "faculty" ? "FACULTY" : "STUDENT_FARMER";

  const buffer = await file.arrayBuffer();
  const result = await parseExcelImportFile(buffer, importType);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Preserves the existing contract: the web preview (parseExcelFile in
  // import-form.tsx) expects the raw rows array as the response body, not
  // a { rows } envelope.
  return NextResponse.json(result.rows);
}
