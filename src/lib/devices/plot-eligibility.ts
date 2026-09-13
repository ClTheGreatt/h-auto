import type { PlotStatus } from "@prisma/client";
import { isActivityPlotStatus } from "@/lib/plots/lifecycle";

export function canLinkDeviceToPlot({
  plotStatus,
  targetPlotId,
  currentPlotId,
}: {
  plotStatus: PlotStatus;
  targetPlotId: string;
  currentPlotId?: string;
}): boolean {
  return (
    isActivityPlotStatus(plotStatus) ||
    (currentPlotId !== undefined && targetPlotId === currentPlotId)
  );
}
