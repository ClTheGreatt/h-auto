import ExcelJS from "exceljs";
import { YEAR_LEVELS } from "@/lib/validations/user";

type ColumnDef = { header: string; key: string };
type ColumnGuideEntry = { name: string; required: boolean; description: string };

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDCFCE7" },
};

const TABLE_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" },
};

const BANDED_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF9FAFB" },
};

const REQUIRED_FONT = { bold: true, color: { argb: "FF16A34A" } };
const OPTIONAL_FONT = { color: { argb: "FF6B7280" } };

const COMMON_NOTES = [
  "All emails must end in @bpsu.edu.ph",
  "Passwords must be at least 8 characters with at least one letter and one number",
  "Phone numbers should be in format +639XXXXXXXXX or 09XXXXXXXXX",
];

const STUDENT_ONLY_NOTE =
  "yearLevel must be exactly one of: 1st Year, 2nd Year, 3rd Year, 4th Year (Student only)";

const CLOSING_NOTES = [
  "Delete the example rows and add your actual data on the Data sheet before uploading",
  "Save as .xlsx or export to .csv — both formats are accepted",
];

function buildDataSheet(
  workbook: ExcelJS.Workbook,
  columns: ColumnDef[],
  rows: string[][],
  dropdown?: { columnKey: string; values: readonly string[] }
) {
  const sheet = workbook.addWorksheet("Data");
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;

  rows.forEach((row) => sheet.addRow(row));

  columns.forEach((col, idx) => {
    const longestValue = rows.reduce(
      (max, row) => Math.max(max, String(row[idx] ?? "").length),
      col.header.length
    );
    sheet.getColumn(idx + 1).width = Math.max(15, longestValue + 2);
  });

  if (dropdown) {
    const colIndex = columns.findIndex((c) => c.key === dropdown.columnKey) + 1;
    for (let r = 2; r <= 1000; r++) {
      sheet.getCell(r, colIndex).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${dropdown.values.join(",")}"`],
      };
    }
  }

  return sheet;
}

function buildInstructionsSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  columnGuide: ColumnGuideEntry[],
  notes: string[]
) {
  const sheet = workbook.addWorksheet("Instructions");
  sheet.columns = [{ width: 20 }, { width: 14 }, { width: 64 }];

  sheet.mergeCells(1, 1, 1, 3);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };

  sheet.mergeCells(3, 1, 3, 3);
  sheet.getCell(3, 1).value = "Column Guide";
  sheet.getCell(3, 1).font = { bold: true, size: 12 };

  const tableHeaderRow = sheet.getRow(4);
  tableHeaderRow.values = ["Column Name", "Required", "Description"];
  tableHeaderRow.font = { bold: true };
  tableHeaderRow.fill = TABLE_HEADER_FILL;

  let row = 5;
  columnGuide.forEach((entry, idx) => {
    const r = sheet.getRow(row);
    r.values = [entry.name, entry.required ? "Required" : "Optional", entry.description];
    r.getCell(2).font = entry.required ? REQUIRED_FONT : OPTIONAL_FONT;
    if (idx % 2 === 1) {
      r.fill = BANDED_ROW_FILL;
    }
    row++;
  });

  row++; // spacer
  sheet.mergeCells(row, 1, row, 3);
  sheet.getCell(row, 1).value = "Notes";
  sheet.getCell(row, 1).font = { bold: true, size: 12 };
  row++;

  notes.forEach((note) => {
    sheet.mergeCells(row, 1, row, 3);
    const cell = sheet.getCell(row, 1);
    cell.value = `• ${note}`;
    cell.alignment = { wrapText: true };
    row++;
  });

  return sheet;
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const FACULTY_COLUMNS: ColumnDef[] = [
  { header: "firstName", key: "firstName" },
  { header: "middleName", key: "middleName" },
  { header: "lastName", key: "lastName" },
  { header: "email", key: "email" },
  { header: "phoneNumber", key: "phoneNumber" },
  { header: "idNumber", key: "idNumber" },
  { header: "department", key: "department" },
  { header: "position", key: "position" },
  { header: "password", key: "password" },
];

const FACULTY_EXAMPLE_ROWS: string[][] = [
  ["Maria Elena", "Santos", "Cruz", "maria.santos@bpsu.edu.ph", "+639171234567", "EMP-2020-001", "College of Computer Studies", "Associate Professor", "TempPass123!"],
  ["Roberto", "Reyes", "Bautista", "roberto.reyes@bpsu.edu.ph", "+639181112233", "EMP-2019-045", "College of Computer Studies", "Instructor", "TempPass123!"],
  ["Jennifer", "Aquino", "Villanueva", "jennifer.aquino@bpsu.edu.ph", "+639172345678", "EMP-2021-089", "College of Agriculture and Aquaculture", "Assistant Professor", "TempPass123!"],
  ["Michael", "Torres", "Delos Reyes", "michael.torres@bpsu.edu.ph", "+639191122334", "EMP-2018-102", "College of Computer Studies", "Department Chair", "TempPass123!"],
];

const FACULTY_COLUMN_GUIDE: ColumnGuideEntry[] = [
  { name: "firstName", required: true, description: "The person's first (given) name" },
  { name: "middleName", required: false, description: "Middle name if applicable" },
  { name: "lastName", required: true, description: "Family name / surname" },
  { name: "email", required: true, description: "Must be @bpsu.edu.ph" },
  { name: "phoneNumber", required: false, description: "Contact number in PH format" },
  { name: "idNumber", required: false, description: "Employee ID" },
  { name: "department", required: false, description: "Department or unit name" },
  { name: "position", required: false, description: "Job title" },
  { name: "password", required: true, description: "Initial password (user can change later)" },
];

const STUDENT_COLUMNS: ColumnDef[] = [
  { header: "firstName", key: "firstName" },
  { header: "middleName", key: "middleName" },
  { header: "lastName", key: "lastName" },
  { header: "email", key: "email" },
  { header: "phoneNumber", key: "phoneNumber" },
  { header: "idNumber", key: "idNumber" },
  { header: "course", key: "course" },
  { header: "yearLevel", key: "yearLevel" },
  { header: "section", key: "section" },
  { header: "password", key: "password" },
];

const STUDENT_EXAMPLE_ROWS: string[][] = [
  ["Chrislord", "Dizon", "Buenaventura", "cbdizon23@bpsu.edu.ph", "+639696227630", "23-03604", "Bachelor of Information Technology Major in Network and Web Application", "4th Year", "NW4D", "TempPass123!"],
  ["Said", "Hussin", "Al-Rashid", "sahussin24@bpsu.edu.ph", "+639181234567", "24-01245", "Bachelor of Information Technology Major in Software Development", "3rd Year", "SD3A", "TempPass123!"],
  ["Geoffrey", "Perello", "Mendoza", "gpperello25@bpsu.edu.ph", "+639172345671", "25-00879", "Bachelor of Information Technology Major in Network and Web Application", "2nd Year", "NW2C", "TempPass123!"],
  ["Jhan Criss", "Alba", "Manalo", "jcalba22@bpsu.edu.ph", "+639191234563", "22-05423", "Bachelor of Information Technology Major in Digital Arts", "4th Year", "DA4B", "TempPass123!"],
];

const STUDENT_COLUMN_GUIDE: ColumnGuideEntry[] = [
  { name: "firstName", required: true, description: "The person's first (given) name" },
  { name: "middleName", required: false, description: "Middle name if applicable" },
  { name: "lastName", required: true, description: "Family name / surname" },
  { name: "email", required: true, description: "Must be @bpsu.edu.ph" },
  { name: "phoneNumber", required: false, description: "Contact number in PH format" },
  { name: "idNumber", required: false, description: "Student ID number" },
  { name: "course", required: false, description: "Course/program (e.g. Bachelor of Information Technology...)" },
  { name: "yearLevel", required: false, description: "Must be exactly: 1st Year, 2nd Year, 3rd Year, or 4th Year" },
  { name: "section", required: false, description: "Section code (e.g. NW4D)" },
  { name: "password", required: true, description: "Initial password (user can change later)" },
];

export async function generateFacultyTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H-Auto";
  workbook.created = new Date();

  buildDataSheet(workbook, FACULTY_COLUMNS, FACULTY_EXAMPLE_ROWS);
  buildInstructionsSheet(
    workbook,
    "H-Auto User Import Template — Faculty",
    FACULTY_COLUMN_GUIDE,
    [...COMMON_NOTES, ...CLOSING_NOTES]
  );

  return toBuffer(workbook);
}

export async function generateStudentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H-Auto";
  workbook.created = new Date();

  buildDataSheet(workbook, STUDENT_COLUMNS, STUDENT_EXAMPLE_ROWS, {
    columnKey: "yearLevel",
    values: YEAR_LEVELS,
  });
  buildInstructionsSheet(
    workbook,
    "H-Auto User Import Template — Student",
    STUDENT_COLUMN_GUIDE,
    [...COMMON_NOTES, STUDENT_ONLY_NOTE, ...CLOSING_NOTES]
  );

  return toBuffer(workbook);
}
