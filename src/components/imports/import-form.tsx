"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Upload,
  XCircle,
} from "lucide-react";
import { commitImport, preflightImport } from "@/actions/import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FACULTY_IMPORT_COLUMNS,
  FACULTY_REQUIRED_FIELDS,
  STUDENT_IMPORT_COLUMNS,
  STUDENT_REQUIRED_FIELDS,
  detectImportTypeMismatch,
  importTypeMismatchMessage,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/constants/user-import";
import {
  IMPORT_FIELD_LABELS,
  advanceAnalysisGeneration,
  analyzeImportMatrix,
  getImportFields,
  isCurrentAnalysisGeneration,
  mapSourceRows,
  matrixFromValues,
  resetAnalysisMapping,
  shouldAutoContinueToPreview,
  updateAnalysisMapping,
  type ImportField,
  type ImportMatrixAnalysis,
  type ImportMatrixRow,
  type ImportSheetCandidate,
} from "@/lib/imports/masterlist-mapping";
import type { ParseExcelResponse } from "@/lib/imports/parse-excel";
import type { ParsedRow } from "@/lib/imports/parse-rows";
import type { ServerImportRow } from "@/lib/imports/preflight";
import { cn } from "@/lib/utils";
import type { ImportRowType } from "@/lib/validations/import";

type CreatedCredential = {
  email: string;
  firstName: string;
  lastName: string;
  tempPassword: string;
};

type ImportResult = {
  success: string[];
  credentials: CreatedCredential[];
  failed: { email: string; reason: string }[];
  totalProcessed: number;
};

type Phase = "idle" | "mapping" | "preview" | "committing" | "done";

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function todayLocalDateStamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisGenerationRef = useRef(0);
  const [importType, setImportType] = useState<ImportRowType>("FACULTY");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [preparedRows, setPreparedRows] = useState<ServerImportRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [hasLegacyPasswordColumn, setHasLegacyPasswordColumn] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvMatrix, setCsvMatrix] = useState<ImportMatrixRow[] | null>(null);
  const [sheets, setSheets] = useState<ImportSheetCandidate[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImportMatrixAnalysis | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isTemplateWorkbook, setIsTemplateWorkbook] = useState(false);

  const allColumns =
    importType === "FACULTY" ? FACULTY_IMPORT_COLUMNS : STUDENT_IMPORT_COLUMNS;
  const requiredColumns: readonly string[] =
    importType === "FACULTY" ? FACULTY_REQUIRED_FIELDS : STUDENT_REQUIRED_FIELDS;
  const targetFields = getImportFields(importType);
  const validCount = rows.filter((row) => row.errors.length === 0).length;
  const invalidCount = rows.length - validCount;
  const selectedSheetCandidate = sheets.find(
    (sheet) => sheet.name === selectedSheet
  );

  function downloadTemplate() {
    const type = importType === "FACULTY" ? "faculty" : "student";
    window.location.href = `/api/users/import/template?type=${type}`;
  }

  function clearDownstreamState() {
    setRows([]);
    setPreparedRows([]);
    setResult(null);
    setHasLegacyPasswordColumn(false);
    setCsvMatrix(null);
    setSheets([]);
    setSelectedSheet(null);
    setAnalysis(null);
    setIsTemplateWorkbook(false);
  }

  function invalidateAnalysisGeneration() {
    advanceAnalysisGeneration(analysisGenerationRef);
    setIsParsing(false);
  }

  function beginAnalysisGeneration(): number {
    const generation = advanceAnalysisGeneration(analysisGenerationRef);
    setIsParsing(true);
    return generation;
  }

  function isCurrentGeneration(generation: number): boolean {
    return isCurrentAnalysisGeneration(
      analysisGenerationRef,
      generation
    );
  }

  function resetForm() {
    invalidateAnalysisGeneration();
    clearDownstreamState();
    setUploadedFile(null);
    setFileName("");
    setPhase("idle");
  }

  function changeImportType(nextType: ImportRowType) {
    if (nextType === importType) return;
    invalidateAnalysisGeneration();
    clearDownstreamState();
    setUploadedFile(null);
    setFileName("");
    setPhase("idle");
    setImportType(nextType);
  }

  async function setCsvAnalysis(
    matrix: ImportMatrixRow[],
    generation: number,
    forcedHeaderRow?: number
  ): Promise<boolean> {
    if (!isCurrentGeneration(generation)) return false;
    const analyzed = analyzeImportMatrix(matrix, importType, {
      fileType: "csv",
      sheetName: "CSV",
      ...(forcedHeaderRow !== undefined ? { forcedHeaderRow } : {}),
    });
    if (!isCurrentGeneration(generation)) return false;
    if ("error" in analyzed) {
      toast.error(analyzed.error);
      return false;
    }

    if (analyzed.analysis.selectedHeaderRow === null) {
      const otherType: ImportRowType =
        importType === "FACULTY" ? "STUDENT_FARMER" : "FACULTY";
      const other = analyzeImportMatrix(matrix, otherType, {
        fileType: "csv",
        sheetName: "CSV",
      });
      if ("analysis" in other && other.analysis.selectedHeaderRow !== null) {
        const header = matrix.find(
          (row) => row.rowNumber === other.analysis.selectedHeaderRow
        );
        const detectedType = header
          ? detectImportTypeMismatch(
              header.cells.map((cell) => cell.text),
              importType
            )
          : null;
        if (detectedType) {
          toast.error(importTypeMismatchMessage(importType, detectedType));
          return false;
        }
      }
    }

    setAnalysis(analyzed.analysis);
    setSelectedSheet("CSV");
    setSheets([
      {
        name: "CSV",
        headerCandidates: analyzed.analysis.headerCandidates,
        selectedHeaderRow: analyzed.analysis.selectedHeaderRow,
        hasQualifiedCandidate: analyzed.analysis.headerCandidates.some(
          (candidate) => candidate.qualifies
        ),
      },
    ]);
    setHasLegacyPasswordColumn(analyzed.analysis.hasLegacyPasswordColumn);
    setIsTemplateWorkbook(false);
    if (shouldAutoContinueToPreview(analyzed.analysis)) {
      await previewAnalysis(analyzed.analysis, generation);
    } else {
      setPhase("mapping");
    }
    return true;
  }

  function parseCsvFile(file: File) {
    const generation = beginAnalysisGeneration();
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: false,
      complete: async (results) => {
        if (!isCurrentGeneration(generation)) return;
        if (results.errors.length > 0) {
          toast.error(
            `CSV parse error: ${results.errors[0].message}. Please check the file format.`
          );
          setIsParsing(false);
          return;
        }
        const matrix = matrixFromValues(results.data);
        setCsvMatrix(matrix);
        await setCsvAnalysis(matrix, generation);
        if (isCurrentGeneration(generation)) setIsParsing(false);
      },
      error: (error) => {
        if (!isCurrentGeneration(generation)) return;
        setIsParsing(false);
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  }

  async function parseExcelFile(
    file: File,
    sheetName?: string,
    headerRow?: number
  ) {
    const generation = beginAnalysisGeneration();
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType === "FACULTY" ? "faculty" : "student");
      if (sheetName) formData.append("sheet", sheetName);
      if (headerRow !== undefined) formData.append("headerRow", String(headerRow));

      const response = await fetch("/api/users/import/parse", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ParseExcelResponse | { error: string };
      if (!isCurrentGeneration(generation)) return;

      if (!response.ok || "error" in data) {
        toast.error(
          ("error" in data && data.error) || "Failed to parse Excel file"
        );
        return;
      }

      setSheets(data.sheets);
      setSelectedSheet(data.selectedSheet);
      setAnalysis(data.analysis);
      setHasLegacyPasswordColumn(data.hasLegacyPasswordColumn);
      setIsTemplateWorkbook(data.isTemplateWorkbook);
      if (shouldAutoContinueToPreview(data.analysis)) {
        await previewAnalysis(data.analysis, generation);
      } else {
        setPhase("mapping");
      }
    } catch {
      if (!isCurrentGeneration(generation)) return;
      toast.error(
        "We couldn't read this Excel workbook. Please verify that it is a valid .xlsx file."
      );
    } finally {
      if (isCurrentGeneration(generation)) setIsParsing(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx");

    if (lowerName.endsWith(".xls")) {
      toast.error(
        "Legacy .xls files are not supported. Save the file as .xlsx or .csv and try again."
      );
      return;
    }
    if (!isCsv && !isXlsx) {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx)");
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      toast.error("File is too large. Maximum upload size is 4 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    invalidateAnalysisGeneration();
    clearDownstreamState();
    setUploadedFile(file);
    setFileName(file.name);
    if (isXlsx) void parseExcelFile(file);
    else parseCsvFile(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSheetChange(sheetName: string) {
    if (!uploadedFile) return;
    setSelectedSheet(sheetName);
    setAnalysis(null);
    setRows([]);
    setPreparedRows([]);
    setResult(null);
    setHasLegacyPasswordColumn(false);
    await parseExcelFile(uploadedFile, sheetName);
  }

  async function handleHeaderRowChange(rowNumber: number) {
    setAnalysis(null);
    setRows([]);
    setPreparedRows([]);
    setResult(null);
    setHasLegacyPasswordColumn(false);
    if (csvMatrix) {
      const generation = beginAnalysisGeneration();
      await setCsvAnalysis(csvMatrix, generation, rowNumber);
      if (isCurrentGeneration(generation)) setIsParsing(false);
      return;
    }
    if (uploadedFile && selectedSheet) {
      await parseExcelFile(uploadedFile, selectedSheet, rowNumber);
    }
  }

  async function handleColumnMapping(sourceIndex: number, value: string) {
    if (!analysis) return;
    const targetField = value === "__IGNORE__" ? null : (value as ImportField);
    const updated = updateAnalysisMapping(
      analysis,
      importType,
      sourceIndex,
      targetField
    );
    if ("error" in updated) {
      toast.error(updated.error);
      return;
    }
    setAnalysis(updated.analysis);
    setRows([]);
    setPreparedRows([]);
    if (shouldAutoContinueToPreview(updated.analysis)) {
      await previewAnalysis(updated.analysis);
    }
  }

  async function previewAnalysis(
    nextAnalysis: ImportMatrixAnalysis,
    generation = beginAnalysisGeneration()
  ) {
    if (!shouldAutoContinueToPreview(nextAnalysis)) {
      toast.error("Map every required H-Auto field before continuing.");
      return;
    }
    const mapped = mapSourceRows(nextAnalysis);
    const payload: ServerImportRow[] = mapped.map((row) => ({
      rowNumber: row.rowNumber,
      raw: row.raw,
      parsingErrors: row.parsingErrors,
    }));
    try {
      const response = await preflightImport(importType, payload);
      if (!isCurrentGeneration(generation)) return;
      if ("error" in response) {
        toast.error(response.error);
        setPhase("mapping");
        return;
      }
      setRows(
        response.rows.map((row) => ({
          rowNumber: row.rowNumber,
          raw: row.raw,
          errors: row.issues.map((issue) => issue.message),
        }))
      );
      setPreparedRows(payload);
      setHasLegacyPasswordColumn(nextAnalysis.hasLegacyPasswordColumn);
      setPhase("preview");
    } catch {
      if (isCurrentGeneration(generation)) {
        toast.error("Could not validate these rows. Please try again.");
        setPhase("mapping");
      }
    } finally {
      if (isCurrentGeneration(generation)) setIsParsing(false);
    }
  }

  async function continueToPreview() {
    if (!analysis) {
      toast.error("Map every required H-Auto field before continuing.");
      return;
    }
    await previewAnalysis(analysis);
  }

  async function handleResetMapping() {
    if (!analysis) return;
    const reset = resetAnalysisMapping(analysis, importType);
    setAnalysis(reset);
    if (shouldAutoContinueToPreview(reset)) {
      await previewAnalysis(reset);
    }
  }

  async function handleCommit() {
    if (validCount === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setPhase("committing");
    try {
      const response = await commitImport(importType, preparedRows, fileName);
      setPhase("done");
      if ("error" in response) {
        toast.error(response.error);
        setPhase("preview");
        return;
      }
      setResult(response);
      if (response.success.length > 0) {
        toast.success(`Imported ${response.success.length} user(s)`);
      }
      if (response.failed.length > 0) {
        toast.warning(`${response.failed.length} row(s) failed`);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setPhase("preview");
    }
  }

  function downloadCredentialsCsv() {
    if (!result || result.credentials.length === 0) return;
    const header = ["firstName", "lastName", "email", "tempPassword"]
      .map(csvField)
      .join(",");
    const lines = result.credentials.map((credential) =>
      [
        credential.firstName,
        credential.lastName,
        credential.email,
        credential.tempPassword,
      ]
        .map(csvField)
        .join(",")
    );
    const blob = new Blob(["\uFEFF" + [header, ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `h-auto-credentials-${todayLocalDateStamp()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Choose import type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-md border bg-card p-1">
              <button
                type="button"
                onClick={() => changeImportType("FACULTY")}
                disabled={isParsing}
                aria-pressed={importType === "FACULTY"}
                className={cn(
                  "rounded px-4 py-1.5 text-sm transition-colors",
                  importType === "FACULTY"
                    ? "bg-green-100 font-medium text-green-700"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Faculty members
              </button>
              <button
                type="button"
                onClick={() => changeImportType("STUDENT_FARMER")}
                disabled={isParsing}
                aria-pressed={importType === "STUDENT_FARMER"}
                className={cn(
                  "rounded px-4 py-1.5 text-sm transition-colors",
                  importType === "STUDENT_FARMER"
                    ? "bg-green-100 font-medium text-green-700"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Student farmers
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Download the template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use the H-Auto template, or upload an existing CSV/Excel
              masterlist. H-Auto will detect supported columns and ignore
              unrelated columns.
            </p>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              Download {importType === "FACULTY" ? "Faculty" : "Student"} template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Upload CSV or Excel</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileSelect}
              disabled={isParsing}
              className="hidden"
              id="user-import-upload"
            />
            <label
              htmlFor="user-import-upload"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:bg-muted",
                isParsing && "pointer-events-none opacity-60"
              )}
            >
              <Upload className="mb-2 size-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                {isParsing ? "Reading file..." : "Click to upload a CSV or Excel file"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supported columns are detected automatically. Mapping appears
                only when required fields need your review.
              </p>
            </label>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "mapping") {
    const usedTargets = new Set(
      analysis?.columns
        .map((column) => column.mappedField)
        .filter((field): field is ImportField => !!field) ?? []
    );
    const headerCandidates = selectedSheetCandidate?.headerCandidates ?? [];

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {importType === "FACULTY" ? "Faculty" : "Student"} import
                </div>
              </div>
            </div>
            {analysis && (
              <Badge
                variant="secondary"
                className={cn(
                  analysis.mappingStatus === "READY" &&
                    "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
                  analysis.mappingStatus !== "READY" &&
                    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                )}
              >
                {analysis.mappingStatus.replace("_", " ")}
              </Badge>
            )}
          </CardContent>
        </Card>

        {!isTemplateWorkbook && sheets.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choose worksheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="import-worksheet">Worksheet</Label>
              <Select
                value={selectedSheet ?? undefined}
                onValueChange={(value) => void handleSheetChange(value)}
                disabled={isParsing}
              >
                <SelectTrigger id="import-worksheet" className="max-w-md">
                  <SelectValue placeholder="Select the worksheet containing users" />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((sheet) => (
                    <SelectItem key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {selectedSheet &&
          !isTemplateWorkbook &&
          headerCandidates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Header row</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Choose or correct the header row from the first 20 rows.
                </p>
                <Label htmlFor="import-header-row">Header row</Label>
                <Select
                  value={
                    analysis?.selectedHeaderRow !== null &&
                    analysis?.selectedHeaderRow !== undefined
                      ? String(analysis.selectedHeaderRow)
                      : undefined
                  }
                  onValueChange={(value) =>
                    void handleHeaderRowChange(Number(value))
                  }
                  disabled={isParsing}
                >
                  <SelectTrigger id="import-header-row" className="max-w-2xl">
                    <SelectValue placeholder="Select the row containing column headers" />
                  </SelectTrigger>
                  <SelectContent>
                    {headerCandidates.map((candidate) => (
                      <SelectItem
                        key={candidate.rowNumber}
                        value={String(candidate.rowNumber)}
                      >
                        Row {candidate.rowNumber} — {candidate.preview || "(empty)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

        {selectedSheet &&
          !isTemplateWorkbook &&
          (!analysis || analysis.selectedHeaderRow === null) &&
          headerCandidates.length === 0 && (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              No non-empty header row was found in the first 20 rows. Choose a
              different worksheet or fix the file and upload it again.
            </div>
          )}

        {analysis && analysis.selectedHeaderRow !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Column mapping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {analysis.fileType === "xlsx" && `${analysis.sheetName} · `}
                Header row {analysis.selectedHeaderRow} · {analysis.sourceRows.length} data row(s)
              </div>

              <div className="space-y-2">
                {analysis.columns.map((column) => {
                  const selectValue = column.mappedField
                    ? column.mappedField
                    : column.status === "IGNORED"
                      ? "__IGNORE__"
                      : "__UNMAPPED__";
                  return (
                    <div
                      key={column.sourceIndex}
                      className="grid grid-cols-1 items-center gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {column.sourceHeader || `Column ${column.sourceIndex + 1}`}
                        </div>
                        {column.issue && (
                          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            {column.issue}
                          </div>
                        )}
                      </div>
                      <Select
                        value={selectValue}
                        onValueChange={(value) =>
                          void handleColumnMapping(column.sourceIndex, value)
                        }
                      >
                        <SelectTrigger
                          aria-label={`Map spreadsheet column ${
                            column.sourceHeader || `Column ${column.sourceIndex + 1}`
                          }`}
                        >
                          <SelectValue placeholder="Choose H-Auto field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__UNMAPPED__" disabled>
                            Choose H-Auto field
                          </SelectItem>
                          <SelectItem value="__IGNORE__">Ignore</SelectItem>
                          {targetFields.map((field) => (
                            <SelectItem
                              key={field}
                              value={field}
                              disabled={
                                usedTargets.has(field) && column.mappedField !== field
                              }
                            >
                              {IMPORT_FIELD_LABELS[field]}
                              {requiredColumns.includes(field) ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className="w-fit text-[10px]">
                        {column.status.replace("_", " ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {analysis.missingRequiredFields.length > 0 && (
                <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    Required mappings still missing: {analysis.missingRequiredFields
                      .map((field) => IMPORT_FIELD_LABELS[field])
                      .join(", ")}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void continueToPreview()}
                  disabled={
                    isParsing ||
                    analysis.mappingStatus !== "READY" ||
                    analysis.sourceRows.length === 0
                  }
                >
                  {isParsing ? "Checking rows..." : "Continue to row preview"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleResetMapping()}
                  disabled={isParsing}
                >
                  Reset automatic mapping
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!analysis && !isParsing && (
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        )}
      </div>
    );
  }

  if (phase === "preview") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {rows.length} row(s) parsed · {importType === "FACULTY" ? "Faculty" : "Student"} import
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {invalidCount} with errors
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {hasLegacyPasswordColumn && (
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            This file contains a password column from an older template. It
            will be ignored; H-Auto generates temporary passwords automatically.
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <span className="text-red-500">*</span> Required field
        </p>
        <div className="overflow-auto rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-32">Status</TableHead>
                {allColumns.map((column) => (
                  <TableHead key={column} className="whitespace-nowrap">
                    {column}
                    {requiredColumns.includes(column) && (
                      <span className="text-red-500">*</span>
                    )}
                  </TableHead>
                ))}
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isValid = row.errors.length === 0;
                return (
                  <TableRow
                    key={row.rowNumber}
                    className={cn(!isValid && "bg-red-50/50")}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          isValid
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {isValid ? (
                          <CheckCircle2 className="mr-1 size-3" />
                        ) : (
                          <XCircle className="mr-1 size-3" />
                        )}
                        {isValid ? "Valid" : "Error"}
                      </Badge>
                    </TableCell>
                    {allColumns.map((column) => (
                      <TableCell
                        key={column}
                        className="max-w-[150px] truncate text-xs text-muted-foreground"
                      >
                        {row.raw[column] || "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-red-600">
                      {row.errors.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {invalidCount > 0 && (
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <strong>{invalidCount} row(s) have errors</strong> and will be
              skipped. Fix and re-upload the file, or proceed with the {validCount} valid row(s).
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleCommit} disabled={validCount === 0}>
            Import {validCount} valid row(s)
          </Button>
          <Button variant="outline" onClick={() => setPhase("mapping")}>
            Back to mapping
          </Button>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "committing") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
          <p className="text-sm text-muted-foreground">
            Importing {validCount} user(s)...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="space-y-4">
        {result.credentials.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              These temporary passwords are shown only once. Download or copy
              them before leaving this page.
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Temporary credentials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={downloadCredentialsCsv}>
                  <Download className="mr-2 size-4" />
                  Download credentials (.csv)
                </Button>
                <div className="overflow-auto rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Temporary password</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.credentials.map((credential) => (
                        <TableRow key={credential.email}>
                          <TableCell className="text-sm">
                            {credential.firstName} {credential.lastName}
                          </TableCell>
                          <TableCell className="text-sm">{credential.email}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {credential.tempPassword}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="py-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="size-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import complete</h2>
                <p className="text-sm text-muted-foreground">
                  Processed {result.totalProcessed} row(s) from {fileName}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-green-200 bg-green-50 p-3">
                <div className="text-xs font-medium text-green-700">
                  Successfully created
                </div>
                <div className="text-2xl font-semibold text-green-700">
                  {result.success.length}
                </div>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <div className="text-xs font-medium text-red-700">Failed</div>
                <div className="text-2xl font-semibold text-red-700">
                  {result.failed.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {result.failed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Failed rows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.failed.map((failure, index) => (
                      <TableRow key={`${failure.email}-${index}`}>
                        <TableCell className="text-sm">{failure.email}</TableCell>
                        <TableCell className="text-sm text-red-600">
                          {failure.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push("/dashboard/users")}>
            <ArrowLeft className="mr-2 size-4" />
            View users
          </Button>
          <Button variant="outline" onClick={resetForm}>
            Import another
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
