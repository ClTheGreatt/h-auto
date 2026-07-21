import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  generateFacultyTemplate,
  generateStudentTemplate,
} from "@/lib/imports/template-generator";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: NextRequest) {
  await requireAdmin();

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "faculty" && type !== "student") {
    return NextResponse.json(
      { error: "Invalid template type. Use type=faculty or type=student." },
      { status: 400 }
    );
  }

  const buffer =
    type === "faculty"
      ? await generateFacultyTemplate()
      : await generateStudentTemplate();

  const importType = type === "faculty" ? "FACULTY" : "STUDENT_FARMER";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": EXCEL_MIME,
      "Content-Disposition": `attachment; filename="h-auto-${importType}-template.xlsx"`,
    },
  });
}
