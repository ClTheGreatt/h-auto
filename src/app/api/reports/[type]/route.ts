import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { parseRange, TIME_RANGES } from "@/lib/analytics/time-range";
import { prisma } from "@/lib/prisma";
import {
  fetchSensorReadingsData,
  fetchPlotPerformanceData,
  fetchGrowthLogData,
  fetchAlertsData,
  fetchActivityData,
} from "@/lib/reports/data-fetchers";
import {
  SensorReadingsPDF,
  PlotPerformancePDF,
  GrowthLogPDF,
  AlertsPDF,
  ActivityPDF,
} from "@/lib/reports/pdf-generators";
import {
  generateSensorReadingsExcel,
  generatePlotPerformanceExcel,
  generateGrowthLogExcel,
  generateAlertsExcel,
  generateActivityExcel,
} from "@/lib/reports/excel-generators";

export const runtime = "nodejs";

const VALID_TYPES = [
  "sensor-readings",
  "plot-performance",
  "growth-log",
  "alerts",
  "activity",
];

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

  // Admin-only check for activity report
  if (
    type === "activity" &&
    session.user.role !== "SUPER_ADMIN" &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") === "excel" ? "excel" : "pdf";
  const range = parseRange(searchParams.get("range") ?? undefined);
  const plotId = searchParams.get("plotId") ?? undefined;

  const rangeLabel =
    TIME_RANGES.find((r) => r.value === range)?.label ?? "7 days";

  // Look up plot name if filtered
  let plotName: string | undefined;
  if (plotId) {
    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      select: { name: true },
    });
    plotName = plot?.name;
  }

  try {
    let buffer: Buffer;
    let mimeType: string;
    let filename: string;
    const timestamp = new Date().toISOString().split("T")[0];

    switch (type) {
      case "sensor-readings": {
        const data = await fetchSensorReadingsData({ range, plotId });
        if (format === "excel") {
          buffer = await generateSensorReadingsExcel(data, rangeLabel, plotName);
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `sensor-readings-${timestamp}.xlsx`;
        } else {
          buffer = await renderToBuffer(
            SensorReadingsPDF({ data, rangeLabel, plotName })
          );
          mimeType = "application/pdf";
          filename = `sensor-readings-${timestamp}.pdf`;
        }
        break;
      }
      case "plot-performance": {
        const data = await fetchPlotPerformanceData({ range });
        if (format === "excel") {
          buffer = await generatePlotPerformanceExcel(data, rangeLabel);
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `plot-performance-${timestamp}.xlsx`;
        } else {
          buffer = await renderToBuffer(
            PlotPerformancePDF({ data, rangeLabel })
          );
          mimeType = "application/pdf";
          filename = `plot-performance-${timestamp}.pdf`;
        }
        break;
      }
      case "growth-log": {
        const data = await fetchGrowthLogData({ range, plotId });
        if (format === "excel") {
          buffer = await generateGrowthLogExcel(data, rangeLabel, plotName);
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `growth-log-${timestamp}.xlsx`;
        } else {
          buffer = await renderToBuffer(
            GrowthLogPDF({ data, rangeLabel, plotName })
          );
          mimeType = "application/pdf";
          filename = `growth-log-${timestamp}.pdf`;
        }
        break;
      }
      case "alerts": {
        const data = await fetchAlertsData({ range, plotId });
        if (format === "excel") {
          buffer = await generateAlertsExcel(data, rangeLabel, plotName);
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `alerts-${timestamp}.xlsx`;
        } else {
          buffer = await renderToBuffer(
            AlertsPDF({ data, rangeLabel, plotName })
          );
          mimeType = "application/pdf";
          filename = `alerts-${timestamp}.pdf`;
        }
        break;
      }
      case "activity": {
        const data = await fetchActivityData({ range });
        if (format === "excel") {
          buffer = await generateActivityExcel(data, rangeLabel);
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `system-activity-${timestamp}.xlsx`;
        } else {
          buffer = await renderToBuffer(ActivityPDF({ data, rangeLabel }));
          mimeType = "application/pdf";
          filename = `system-activity-${timestamp}.pdf`;
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
    console.error("Report generation failed:", error);
    return NextResponse.json(
      {
        error: "Report generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}