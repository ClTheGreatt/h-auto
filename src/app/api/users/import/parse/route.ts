import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth-helpers";
import { buildParsedRows } from "@/lib/imports/parse-rows";
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

  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Data") ?? workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json(
        { error: "Could not find a sheet with data in this Excel file" },
        { status: 400 }
      );
    }

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const data: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header row, already read above

      const record: Record<string, string> = {};
      let hasValue = false;
      headers.forEach((header, idx) => {
        if (!header) return;
        const value = row.getCell(idx + 1).value;
        const text = value == null ? "" : String(value);
        record[header] = text;
        if (text) hasValue = true;
      });
      if (hasValue) data.push(record);
    });

    const rows = buildParsedRows(data, importType);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to parse Excel file: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 400 }
    );
  }
}
