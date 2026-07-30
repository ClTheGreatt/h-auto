import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseRange, TIME_RANGES } from "@/lib/analytics/time-range";
import { prisma } from "@/lib/prisma";
import { assertCanAccessPlot } from "@/lib/auth/plot-access";
import { parseOptionalPlotIdSearchParams } from "@/lib/auth/plot-id";
import {
  fetchSensorReadingsData,
  fetchPlotPerformanceData,
  fetchGrowthLogData,
  fetchAlertsData,
  fetchActivityData,
  fetchStudentActivityData,
  buildReportPlotWhere,
} from "@/lib/reports/data-fetchers";
import { getManilaDateKey } from "@/lib/analytics/manila-dates";
import {
  renderSensorReadingsPDF,
  renderPlotPerformancePDF,
  renderGrowthLogPDF,
  renderAlertsPDF,
  renderActivityPDF,
  renderStudentActivityPDF,
} from "@/lib/reports/pdf-renderers";
import {
  generateSensorReadingsExcel,
  generatePlotPerformanceExcel,
  generateGrowthLogExcel,
  generateAlertsExcel,
  generateActivityExcel,
  generateStudentActivityExcel,
} from "@/lib/reports/excel-generators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = [
  "sensor-readings",
  "plot-performance",
  "growth-log",
  "alerts",
  "activity",
  "student-activity",
];

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  if (
    type === "activity" &&
    session.user.role !== "SUPER_ADMIN" &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    type === "student-activity" &&
    session.user.role !== "SUPER_ADMIN" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "FACULTY"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") === "excel" ? "excel" : "pdf";
  const range = parseRange(searchParams.get("range") ?? undefined);
  const parsedPlotId = parseOptionalPlotIdSearchParams(searchParams);
  if (parsedPlotId.kind === "invalid") {
    return NextResponse.json({ error: "Invalid plotId" }, { status: 400 });
  }
  const plotId =
    parsedPlotId.kind === "valid" ? parsedPlotId.plotId : undefined;

  if (
    plotId !== undefined &&
    !(await assertCanAccessPlot(session.user.role, session.user.id, plotId))
  ) {
    return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  }

  const rangeLabel =
    TIME_RANGES.find((r) => r.value === range)?.label ?? "7 days";

  let plotName: string | undefined;
  if (plotId !== undefined) {
    const plot = await prisma.plot.findFirst({
      where: buildReportPlotWhere(
        session.user.role,
        session.user.id,
        { id: plotId }
      ),
      select: { name: true },
    });
    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }
    plotName = plot.name;
  }

  try {
    let buffer: Buffer;
    let mimeType: string;
    let filename: string;
    const timestamp = getManilaDateKey(new Date());

    switch (type) {
      case "sensor-readings": {
        const data = await fetchSensorReadingsData({
          range,
          plotId,
          role: session.user.role,
          userId: session.user.id,
        });
        if (format === "excel") {
          buffer = await generateSensorReadingsExcel(data, rangeLabel, plotName);
          mimeType = EXCEL_MIME;
          filename = `sensor-readings-${timestamp}.xlsx`;
        } else {
          buffer = await renderSensorReadingsPDF(data, rangeLabel, plotName);
          mimeType = "application/pdf";
          filename = `sensor-readings-${timestamp}.pdf`;
        }
        break;
      }
      case "plot-performance": {
        const data = await fetchPlotPerformanceData({
          range,
          role: session.user.role,
          userId: session.user.id,
        });
        if (format === "excel") {
          buffer = await generatePlotPerformanceExcel(data, rangeLabel);
          mimeType = EXCEL_MIME;
          filename = `plot-performance-${timestamp}.xlsx`;
        } else {
          buffer = await renderPlotPerformancePDF(data, rangeLabel);
          mimeType = "application/pdf";
          filename = `plot-performance-${timestamp}.pdf`;
        }
        break;
      }
      case "growth-log": {
        const data = await fetchGrowthLogData({
          range,
          plotId,
          role: session.user.role,
          userId: session.user.id,
        });
        if (format === "excel") {
          buffer = await generateGrowthLogExcel(data, rangeLabel, plotName);
          mimeType = EXCEL_MIME;
          filename = `growth-log-${timestamp}.xlsx`;
        } else {
          buffer = await renderGrowthLogPDF(data, rangeLabel, plotName);
          mimeType = "application/pdf";
          filename = `growth-log-${timestamp}.pdf`;
        }
        break;
      }
      case "alerts": {
        const data = await fetchAlertsData({
          range,
          plotId,
          role: session.user.role,
          userId: session.user.id,
        });
        if (format === "excel") {
          buffer = await generateAlertsExcel(data, rangeLabel, plotName);
          mimeType = EXCEL_MIME;
          filename = `alerts-${timestamp}.xlsx`;
        } else {
          buffer = await renderAlertsPDF(data, rangeLabel, plotName);
          mimeType = "application/pdf";
          filename = `alerts-${timestamp}.pdf`;
        }
        break;
      }
      case "activity": {
        const data = await fetchActivityData({ range });
        if (format === "excel") {
          buffer = await generateActivityExcel(data, rangeLabel);
          mimeType = EXCEL_MIME;
          filename = `system-activity-${timestamp}.xlsx`;
        } else {
          buffer = await renderActivityPDF(data, rangeLabel);
          mimeType = "application/pdf";
          filename = `system-activity-${timestamp}.pdf`;
        }
        break;
      }
      case "student-activity": {
        const data = await fetchStudentActivityData({
          range,
          role: session.user.role,
          userId: session.user.id,
        });
        if (format === "excel") {
          buffer = await generateStudentActivityExcel(data, rangeLabel);
          mimeType = EXCEL_MIME;
          filename = `student-activity-${timestamp}.xlsx`;
        } else {
          buffer = await renderStudentActivityPDF(data, rangeLabel);
          mimeType = "application/pdf";
          filename = `student-activity-${timestamp}.pdf`;
        }
        break;
      }
      default:
        return NextResponse.json(
          { error: "Unknown report type" },
          { status: 400 }
        );
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("=".repeat(60));
    console.error("REPORT GENERATION FAILED");
    console.error("Type:", type);
    console.error("Format:", format);
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    console.error("=".repeat(60));

    return NextResponse.json(
      {
        error: "Report generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        type,
        format,
      },
      { status: 500 }
    );
  }
}
