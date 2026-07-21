"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type ImportRowType } from "@/lib/validations/import";
import { commitImport } from "@/actions/import";
import { buildParsedRows, type ParsedRow } from "@/lib/imports/parse-rows";

type ImportResult = {
  success: string[];
  failed: { email: string; reason: string }[];
  totalProcessed: number;
};

type Phase = "idle" | "preview" | "committing" | "done";

export function ImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<ImportRowType>("FACULTY");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    const type = importType === "FACULTY" ? "faculty" : "student";
    window.location.href = `/api/users/import/template?type=${type}`;
  }

  function parseCsvFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error(
            `CSV parse error: ${results.errors[0].message}. Please check the file format.`
          );
          return;
        }

        setRows(buildParsedRows(results.data, importType));
        setPhase("preview");
      },
      error: (err) => {
        toast.error(`Failed to parse CSV: ${err.message}`);
      },
    });
  }

  async function parseExcelFile(file: File) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType === "FACULTY" ? "faculty" : "student");

      const response = await fetch("/api/users/import/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to parse Excel file");
        return;
      }

      setRows(data as ParsedRow[]);
      setPhase("preview");
    } catch (err) {
      toast.error(
        `Failed to parse Excel file: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx");

    if (!isCsv && !isXlsx) {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx)");
      return;
    }

    setFileName(file.name);

    if (isXlsx) {
      void parseExcelFile(file);
    } else {
      parseCsvFile(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCommit() {
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => r.raw);

    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setPhase("committing");
    const res = await commitImport(importType, validRows, fileName);
    setPhase("done");

    if ("error" in res) {
      toast.error(res.error);
      setPhase("preview");
      return;
    }

    setResult(res);

    if (res.success.length > 0) {
      toast.success(`Imported ${res.success.length} user(s)`);
    }
    if (res.failed.length > 0) {
      toast.warning(`${res.failed.length} row(s) failed`);
    }
  }

  function resetForm() {
    setPhase("idle");
    setRows([]);
    setResult(null);
    setFileName("");
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;
  const allColumns =
    importType === "FACULTY"
      ? [
          "firstName",
          "middleName",
          "lastName",
          "email",
          "phoneNumber",
          "idNumber",
          "department",
          "position",
          "password",
        ]
      : [
          "firstName",
          "middleName",
          "lastName",
          "email",
          "phoneNumber",
          "idNumber",
          "course",
          "yearLevel",
          "section",
          "password",
        ];

  // ============= IDLE =============
  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Choose import type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-md border bg-white p-1">
              <button
                type="button"
                onClick={() => setImportType("FACULTY")}
                className={cn(
                  "px-4 py-1.5 text-sm rounded transition-colors",
                  importType === "FACULTY"
                    ? "bg-green-100 text-green-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                Faculty members
              </button>
              <button
                type="button"
                onClick={() => setImportType("STUDENT_FARMER")}
                className={cn(
                  "px-4 py-1.5 text-sm rounded transition-colors",
                  importType === "STUDENT_FARMER"
                    ? "bg-green-100 text-green-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
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
            <p className="text-sm text-gray-600">
              The template shows the exact column headers you need, with an
              Instructions sheet explaining each one. Fill in your{" "}
              {importType === "FACULTY" ? "faculty" : "student"} data, and
              upload it as .xlsx or export it to .csv.
            </p>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download {importType === "FACULTY" ? "Faculty" : "Student"} template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Upload your filled file</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">
                Click to upload a CSV or Excel file
              </p>
              <p className="text-xs text-gray-500 mt-1">
                You&apos;ll see a preview before anything is saved
              </p>
            </label>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============= PREVIEW =============
  if (phase === "preview") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium">{fileName}</div>
                  <div className="text-xs text-gray-500">
                    {rows.length} row(s) parsed •{" "}
                    {importType === "FACULTY" ? "Faculty" : "Student"} import
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
            </div>
          </CardContent>
        </Card>

        <div className="border rounded-md bg-white overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-32">Status</TableHead>
                {allColumns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap">
                    {col}
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
                    <TableCell className="text-xs text-gray-500">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell>
                      {isValid ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-700"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    {allColumns.map((col) => (
                      <TableCell key={col} className="text-xs text-gray-600 max-w-[150px] truncate">
                        {col === "password" && row.raw[col]
                          ? "••••••"
                          : row.raw[col] || "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-red-600">
                      {row.errors.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.errors.map((e, i) => (
                            <li key={i}>{e}</li>
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
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>{invalidCount} row(s) have errors</strong> and will be
              skipped. You can cancel, fix the CSV, and re-upload, or proceed
              with only the {validCount} valid row(s).
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleCommit} disabled={validCount === 0}>
            Import {validCount} valid row(s)
          </Button>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ============= COMMITTING =============
  if (phase === "committing") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-600">
            Importing {validCount} user(s)...
          </p>
        </CardContent>
      </Card>
    );
  }

  // ============= DONE =============
  if (phase === "done" && result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import complete</h2>
                <p className="text-sm text-gray-500">
                  Processed {result.totalProcessed} row(s) from {fileName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <div className="text-xs text-green-700 font-medium">
                  Successfully created
                </div>
                <div className="text-2xl font-semibold text-green-700">
                  {result.success.length}
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <div className="text-xs text-red-700 font-medium">Failed</div>
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
              <div className="border rounded-md bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.failed.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{f.email}</TableCell>
                        <TableCell className="text-sm text-red-600">
                          {f.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => router.push("/dashboard/users")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
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