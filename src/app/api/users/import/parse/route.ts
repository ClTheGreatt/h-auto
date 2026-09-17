import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseExcelImportFile } from "@/lib/imports/parse-excel";
import type { ImportRowType } from "@/lib/validations/import";

export async function POST(req: NextRequest) {
  await requireAdmin();

  const formData = await req.formData();
  const file = formData.get("file");
  const type = formData.get("type");
  const selectedSheet = formData.get("sheet");
  const selectedHeaderRow = formData.get("headerRow");

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

  let headerRow: number | undefined;
  if (typeof selectedHeaderRow === "string" && selectedHeaderRow !== "") {
    headerRow = Number(selectedHeaderRow);
    if (!Number.isInteger(headerRow)) {
      return NextResponse.json(
        { error: "Header row must be a whole number." },
        { status: 400 }
      );
    }
  }

  const buffer = await file.arrayBuffer();
  const result = await parseExcelImportFile(buffer, importType, {
    ...(typeof selectedSheet === "string" && selectedSheet
      ? { selectedSheet }
      : {}),
    ...(headerRow !== undefined ? { selectedHeaderRow: headerRow } : {}),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // The browser rebuilds validation rows after the administrator reviews the
  // mapping. Avoid returning the redundant server-built copy; only the
  // bounded selected-sheet source rows needed for manual mapping cross the
  // boundary.
  return NextResponse.json({
    fileType: result.fileType,
    isTemplateWorkbook: result.isTemplateWorkbook,
    sheets: result.sheets,
    selectedSheet: result.selectedSheet,
    mappingStatus: result.mappingStatus,
    analysis: result.analysis,
    hasLegacyPasswordColumn: result.hasLegacyPasswordColumn,
  });
}
