import ExcelJS from "exceljs";
import { YEAR_LEVELS } from "@/lib/validations/user";
import {
  DEPARTMENTS,
  FACULTY_POSITIONS,
  FACULTY_REQUIRED_FIELDS,
  STUDENT_REQUIRED_FIELDS,
  studentIdPrefixRange,
} from "@/lib/constants/user-import";

type ColumnDef = { header: string; key: string; required: boolean };
type ColumnGuideEntry = { name: string; required: boolean; description: string };
// Inline list: a literal comma-separated formula (fine for short lists —
// Excel's classic data-validation list formula has a ~255-char limit).
// Sheet range: references the hidden Lists sheet instead, for lists too
// long to fit inline (e.g. the 18 faculty positions).
type DropdownSpec =
  | { columnKey: string; values: readonly string[] }
  | { columnKey: string; sheetRange: string };

const REQUIRED_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDCFCE7" },
};

const OPTIONAL_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
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

const { min: STUDENT_ID_MIN, max: STUDENT_ID_MAX } = studentIdPrefixRange();

const COMMON_NOTES = [
  "All emails must end in @bpsu.edu.ph",
  "Passwords must be at least 8 characters with at least one letter and one number",
  "Phone numbers, if provided, must be in format +639XXXXXXXXX (09XXXXXXXXX is NOT accepted for import)",
];

const STUDENT_ONLY_NOTE =
  "yearLevel must be exactly one of: 1st Year, 2nd Year, 3rd Year, 4th Year (Student only)";

const CLOSING_NOTES = [
  "Delete the example rows and add your actual data on the Data sheet before uploading",
  "Save as .xlsx or export to .csv — both formats are accepted",
];

// Hidden lookup sheet backing the position/department/course dropdowns —
// FACULTY_POSITIONS has 18 entries, too long for an inline list formula
// (Excel's classic ~255-char limit), so it's referenced by cell range
// instead. DEPARTMENTS is short enough to inline but lives here too for
// one consistent lookup source.
const POSITION_RANGE = `Lists!$A$2:$A$${1 + FACULTY_POSITIONS.length}`;
const DEPARTMENT_RANGE = `Lists!$B$2:$B$${1 + DEPARTMENTS.length}`;

function buildListsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Lists", { state: "veryHidden" });
  sheet.getColumn(1).values = ["Position", ...FACULTY_POSITIONS];
  sheet.getColumn(2).values = ["Department", ...DEPARTMENTS];
  return sheet;
}

function makeColumns(keys: string[], required: readonly string[]): ColumnDef[] {
  return keys.map((key) => ({
    header: key,
    key,
    required: (required as readonly string[]).includes(key),
  }));
}

// Header stays on row 1 (data from row 2) — deliberately NOT shifted down
// for a separate legend row. The parse route reads row 1 as headers, and
// exporting this sheet to CSV (an explicitly supported upload format) would
// turn an inserted legend row into bogus CSV headers, breaking the whole
// row-1-header assumption both parse paths rely on. The asterisk/fill on
// the header cells themselves is the always-visible signal; a cell note on
// the first header explains the convention for anyone opening the .xlsx.
const HEADER_ROW = 1;
const FIRST_DATA_ROW = HEADER_ROW + 1;

function buildDataSheet(
  workbook: ExcelJS.Workbook,
  columns: ColumnDef[],
  rows: string[][],
  dropdowns?: DropdownSpec[]
) {
  const sheet = workbook.addWorksheet("Data");

  columns.forEach((col, idx) => {
    const cell = sheet.getCell(HEADER_ROW, idx + 1);
    cell.value = col.required ? `${col.header} *` : col.header;
    cell.font = { bold: true };
    cell.fill = col.required ? REQUIRED_HEADER_FILL : OPTIONAL_HEADER_FILL;
  });

  // Note (hover) on the first header cell — explains the asterisk/fill
  // legend without inserting a row that would shift CSV/Excel parsing.
  sheet.getCell(HEADER_ROW, 1).note =
    "Required fields are marked with * and shaded green in the header row. " +
    "Optional fields are unmarked and shaded gray. See the Instructions " +
    "sheet's \"Required fields\" section for the full list.";

  rows.forEach((row, rIdx) => {
    row.forEach((value, cIdx) => {
      sheet.getCell(FIRST_DATA_ROW + rIdx, cIdx + 1).value = value;
    });
  });

  columns.forEach((col, idx) => {
    const headerLen = col.header.length + (col.required ? 2 : 0);
    const longestValue = rows.reduce(
      (max, row) => Math.max(max, String(row[idx] ?? "").length),
      headerLen
    );
    sheet.getColumn(idx + 1).width = Math.max(15, longestValue + 2);
  });

  if (dropdowns) {
    for (const dropdown of dropdowns) {
      const colIndex = columns.findIndex((c) => c.key === dropdown.columnKey) + 1;
      if (colIndex < 1) continue;
      const formula =
        "values" in dropdown ? `"${dropdown.values.join(",")}"` : dropdown.sheetRange;
      for (let r = FIRST_DATA_ROW; r <= 1000; r++) {
        sheet.getCell(r, colIndex).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formula],
        };
      }
    }
  }

  return sheet;
}

function buildInstructionsSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  requiredFields: readonly string[],
  columnGuide: ColumnGuideEntry[],
  notes: string[]
) {
  const sheet = workbook.addWorksheet("Instructions");
  sheet.columns = [{ width: 20 }, { width: 14 }, { width: 64 }];

  sheet.mergeCells(1, 1, 1, 3);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };

  sheet.mergeCells(3, 1, 3, 3);
  sheet.getCell(3, 1).value = "Required fields";
  sheet.getCell(3, 1).font = { bold: true, size: 12 };
  sheet.mergeCells(4, 1, 4, 3);
  sheet.getCell(4, 1).value = requiredFields.join(", ");
  sheet.getCell(4, 1).font = REQUIRED_FONT;
  sheet.getCell(4, 1).alignment = { wrapText: true };

  sheet.mergeCells(6, 1, 6, 3);
  sheet.getCell(6, 1).value = "Column Guide";
  sheet.getCell(6, 1).font = { bold: true, size: 12 };

  const tableHeaderRow = sheet.getRow(7);
  tableHeaderRow.values = ["Column Name", "Required", "Description"];
  tableHeaderRow.font = { bold: true };
  tableHeaderRow.fill = TABLE_HEADER_FILL;

  let row = 8;
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

const FACULTY_COLUMNS: ColumnDef[] = makeColumns(
  ["firstName", "middleName", "lastName", "email", "phoneNumber", "idNumber", "department", "position", "password"],
  FACULTY_REQUIRED_FIELDS
);

const FACULTY_EXAMPLE_ROWS: string[][] = [
  ["Maria Elena", "Santos", "Cruz", "maria.santos@bpsu.edu.ph", "+639171234567", "202000-0001", "BS Agriculture - Animal Science", "Associate Professor III", "TempPass123!"],
  ["Roberto", "Reyes", "Bautista", "roberto.reyes@bpsu.edu.ph", "+639181112233", "201900-0045", "BS Agriculture - Crop Science", "Instructor I", "TempPass123!"],
  ["Jennifer", "Aquino", "Villanueva", "jennifer.aquino@bpsu.edu.ph", "+639172345678", "202100-0089", "BTVTEd - Animal Production", "Assistant Professor II", "TempPass123!"],
  ["Michael", "Torres", "Delos Reyes", "michael.torres@bpsu.edu.ph", "+639191122334", "201800-0102", "BS Agricultural and Biosystems Engineering", "Professor I", "TempPass123!"],
];

const FACULTY_COLUMN_GUIDE: ColumnGuideEntry[] = [
  { name: "firstName", required: FACULTY_REQUIRED_FIELDS.includes("firstName"), description: "The person's first (given) name" },
  { name: "middleName", required: (FACULTY_REQUIRED_FIELDS as readonly string[]).includes("middleName"), description: "Middle name if applicable" },
  { name: "lastName", required: FACULTY_REQUIRED_FIELDS.includes("lastName"), description: "Family name / surname" },
  { name: "email", required: FACULTY_REQUIRED_FIELDS.includes("email"), description: "Must be @bpsu.edu.ph" },
  { name: "phoneNumber", required: (FACULTY_REQUIRED_FIELDS as readonly string[]).includes("phoneNumber"), description: "+639XXXXXXXXX, if provided" },
  { name: "idNumber", required: FACULTY_REQUIRED_FIELDS.includes("idNumber"), description: "Format: 123456-1234 (6 digits, dash, 4 digits)" },
  { name: "department", required: FACULTY_REQUIRED_FIELDS.includes("department"), description: "Pick from the dropdown — one of 5 official department names (listed below)" },
  { name: "position", required: FACULTY_REQUIRED_FIELDS.includes("position"), description: "Pick from the dropdown — one of 18 official faculty ranks (listed below)" },
  { name: "password", required: FACULTY_REQUIRED_FIELDS.includes("password"), description: "Initial password (user can change later)" },
];

const STUDENT_COLUMNS: ColumnDef[] = makeColumns(
  ["firstName", "middleName", "lastName", "email", "phoneNumber", "idNumber", "course", "yearLevel", "section", "password"],
  STUDENT_REQUIRED_FIELDS
);

const STUDENT_EXAMPLE_ROWS: string[][] = [
  ["Chrislord", "Dizon", "Buenaventura", "cbdizon23@bpsu.edu.ph", "+639696227630", "23-03604", "BS Agriculture - Animal Science", "4th Year", "BSA-4A", "TempPass123!"],
  ["Said", "Hussin", "Al-Rashid", "sahussin24@bpsu.edu.ph", "+639181234567", "24-01245", "BTVTEd - Animal Production", "3rd Year", "BTVTED-3B", "TempPass123!"],
  ["Geoffrey", "Perello", "Mendoza", "gpperello25@bpsu.edu.ph", "+639172345671", "25-00879", "BS Agriculture - Crop Science", "2nd Year", "BSA-2C", "TempPass123!"],
  ["Jhan Criss", "Alba", "Manalo", "jcalba22@bpsu.edu.ph", "+639191234563", "22-05423", "BS Agricultural and Biosystems Engineering", "4th Year", "BSABE-4D", "TempPass123!"],
];

const STUDENT_COLUMN_GUIDE: ColumnGuideEntry[] = [
  { name: "firstName", required: STUDENT_REQUIRED_FIELDS.includes("firstName"), description: "The person's first (given) name" },
  { name: "middleName", required: (STUDENT_REQUIRED_FIELDS as readonly string[]).includes("middleName"), description: "Middle name if applicable" },
  { name: "lastName", required: STUDENT_REQUIRED_FIELDS.includes("lastName"), description: "Family name / surname" },
  { name: "email", required: STUDENT_REQUIRED_FIELDS.includes("email"), description: "Must be @bpsu.edu.ph" },
  { name: "phoneNumber", required: (STUDENT_REQUIRED_FIELDS as readonly string[]).includes("phoneNumber"), description: "+639XXXXXXXXX, if provided" },
  { name: "idNumber", required: STUDENT_REQUIRED_FIELDS.includes("idNumber"), description: `Format: 12-34567 (2-digit year prefix ${STUDENT_ID_MIN}–${STUDENT_ID_MAX}, dash, 5 digits)` },
  { name: "course", required: STUDENT_REQUIRED_FIELDS.includes("course"), description: "Pick from the dropdown — one of 5 official program names (listed below)" },
  { name: "yearLevel", required: (STUDENT_REQUIRED_FIELDS as readonly string[]).includes("yearLevel"), description: "Must be exactly: 1st Year, 2nd Year, 3rd Year, or 4th Year" },
  { name: "section", required: STUDENT_REQUIRED_FIELDS.includes("section"), description: "Format: PREFIX-YN, e.g. BSA-1A, BTVTED-2B, BSABE-3C" },
  { name: "password", required: STUDENT_REQUIRED_FIELDS.includes("password"), description: "Initial password (user can change later)" },
];

export async function generateFacultyTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H-Auto";
  workbook.created = new Date();

  buildListsSheet(workbook);
  buildDataSheet(workbook, FACULTY_COLUMNS, FACULTY_EXAMPLE_ROWS, [
    { columnKey: "department", sheetRange: DEPARTMENT_RANGE },
    { columnKey: "position", sheetRange: POSITION_RANGE },
  ]);
  buildInstructionsSheet(
    workbook,
    "H-Auto User Import Template — Faculty",
    FACULTY_REQUIRED_FIELDS,
    FACULTY_COLUMN_GUIDE,
    [
      ...COMMON_NOTES,
      `Valid positions (18): ${FACULTY_POSITIONS.join(", ")}`,
      `Valid departments (5): ${DEPARTMENTS.join(", ")}`,
      ...CLOSING_NOTES,
    ]
  );

  return toBuffer(workbook);
}

export async function generateStudentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H-Auto";
  workbook.created = new Date();

  buildListsSheet(workbook);
  buildDataSheet(workbook, STUDENT_COLUMNS, STUDENT_EXAMPLE_ROWS, [
    { columnKey: "course", sheetRange: DEPARTMENT_RANGE },
    { columnKey: "yearLevel", values: YEAR_LEVELS },
  ]);
  buildInstructionsSheet(
    workbook,
    "H-Auto User Import Template — Student",
    STUDENT_REQUIRED_FIELDS,
    STUDENT_COLUMN_GUIDE,
    [
      ...COMMON_NOTES,
      STUDENT_ONLY_NOTE,
      `Valid courses (5): ${DEPARTMENTS.join(", ")}`,
      "Section prefix must match the course's program (BSA / BTVTED / BSABE) — not cross-checked automatically",
      ...CLOSING_NOTES,
    ]
  );

  return toBuffer(workbook);
}
