import type { PlotStatus } from "@prisma/client";

/**
 * Canonical plot lifecycle groupings — the single source of truth for which
 * PlotStatus values belong to which lifecycle class. Every consumer that
 * needs to scope a query by plot lifecycle (analytics, dashboard activity,
 * monitoring, reports, alerts, device-offline detection, ...) should derive
 * from these arrays rather than redeclaring its own status list.
 *
 * Every PlotStatus enum member must belong to exactly one of:
 *   - SETUP:       plot is being configured; no crop is in the ground yet.
 *   - OPERATIONAL: plot has an active crop and expects live device
 *                  monitoring / alerting.
 *   - HISTORICAL:  plot's crop cycle has ended; kept for record-keeping
 *                  only, no live monitoring expected.
 */
const SETUP = ["PREPARING"] as const;
const OPERATIONAL = ["PLANTED", "GROWING", "READY_FOR_HARVEST"] as const;
const HISTORICAL = ["HARVESTED", "FALLOW", "ARCHIVED"] as const;

// Compile-time exhaustiveness guard: if a new PlotStatus is added to the
// Prisma schema without also classifying it into SETUP/OPERATIONAL/
// HISTORICAL above, PlotStatus is no longer a subset of the classified
// union below, and this assignment fails typecheck instead of the new
// status silently falling out of every scope that relies on this module.
type ClassifiedPlotStatus =
  | (typeof SETUP)[number]
  | (typeof OPERATIONAL)[number]
  | (typeof HISTORICAL)[number];
type AssertAllPlotStatusesClassified = PlotStatus extends ClassifiedPlotStatus
  ? true
  : never;
const _allPlotStatusesClassified: AssertAllPlotStatusesClassified = true;
void _allPlotStatusesClassified;

export const SETUP_PLOT_STATUSES: PlotStatus[] = [...SETUP];
export const OPERATIONAL_PLOT_STATUSES: PlotStatus[] = [...OPERATIONAL];
export const HISTORICAL_PLOT_STATUSES: PlotStatus[] = [...HISTORICAL];

export const ACTIVITY_PLOT_STATUSES: PlotStatus[] = [...SETUP, ...OPERATIONAL];

// Statuses with no dedicated action and no companion timestamp field to keep
// in sync — safe to expose as a plain, unconfirmed dropdown on the generic
// plot edit form (and to enforce server-side there). HARVESTED and ARCHIVED
// are deliberately excluded even though FALLOW shares their HISTORICAL
// classification above: each of those two has its own dedicated action
// (harvestPlot/archivePlot) that also writes a companion timestamp
// (harvestedAt/archivedAt), and setting either from this generic form would
// leave that timestamp stale.
export const FORM_EDITABLE_PLOT_STATUSES: PlotStatus[] = [
  ...ACTIVITY_PLOT_STATUSES,
  "FALLOW",
];
