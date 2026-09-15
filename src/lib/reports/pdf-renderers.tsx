import { renderToBuffer } from "@react-pdf/renderer";
import {
  SensorReadingsPDF,
  PlotPerformancePDF,
  GrowthLogPDF,
  AlertsPDF,
  ActivityPDF,
  StudentActivityPDF,
} from "./pdf-generators";
import { loadReportBrandingAssets } from "./branding-assets";

// Types for the data each renderer accepts
type SensorReadingsData = Parameters<typeof SensorReadingsPDF>[0]["data"];
type PlotPerformanceData = Parameters<typeof PlotPerformancePDF>[0]["data"];
type GrowthLogData = Parameters<typeof GrowthLogPDF>[0]["data"];
type AlertsData = Parameters<typeof AlertsPDF>[0]["data"];
type ActivityData = Parameters<typeof ActivityPDF>[0]["data"];
type StudentActivityData = Parameters<typeof StudentActivityPDF>[0]["data"];

export async function renderSensorReadingsPDF(
  data: SensorReadingsData,
  rangeLabel: string,
  plotName?: string
): Promise<Buffer> {
  const assets = await loadReportBrandingAssets();
  return await renderToBuffer(
    <SensorReadingsPDF
      data={data}
      rangeLabel={rangeLabel}
      plotName={plotName}
      assets={assets}
    />
  );
}

export async function renderPlotPerformancePDF(
  data: PlotPerformanceData,
  rangeLabel: string
): Promise<Buffer> {
  const assets = await loadReportBrandingAssets();
  return await renderToBuffer(
    <PlotPerformancePDF data={data} rangeLabel={rangeLabel} assets={assets} />
  );
}

export async function renderGrowthLogPDF(
  data: GrowthLogData,
  rangeLabel: string,
  plotName?: string
): Promise<Buffer> {
  const assets = await loadReportBrandingAssets();
  return await renderToBuffer(
    <GrowthLogPDF
      data={data}
      rangeLabel={rangeLabel}
      plotName={plotName}
      assets={assets}
    />
  );
}

export async function renderAlertsPDF(
  data: AlertsData,
  rangeLabel: string,
  plotName?: string
): Promise<Buffer> {
  const assets = await loadReportBrandingAssets();
  return await renderToBuffer(
    <AlertsPDF
      data={data}
      rangeLabel={rangeLabel}
      plotName={plotName}
      assets={assets}
    />
  );
}

export async function renderActivityPDF(
  data: ActivityData,
  rangeLabel: string
): Promise<Buffer> {
  const assets = await loadReportBrandingAssets();
  return await renderToBuffer(
    <ActivityPDF data={data} rangeLabel={rangeLabel} assets={assets} />
  );
}

export async function renderStudentActivityPDF(
  data: StudentActivityData,
  rangeLabel: string
): Promise<Buffer> {
  const assets = await loadReportBrandingAssets();
  return await renderToBuffer(
    <StudentActivityPDF data={data} rangeLabel={rangeLabel} assets={assets} />
  );
}
