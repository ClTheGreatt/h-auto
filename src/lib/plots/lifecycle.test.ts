import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlotStatus } from "@prisma/client";
import {
  SETUP_PLOT_STATUSES,
  OPERATIONAL_PLOT_STATUSES,
  HISTORICAL_PLOT_STATUSES,
  ACTIVITY_PLOT_STATUSES,
  isActivityPlotStatus,
  isHistoricalPlotStatus,
  isOperationalPlotStatus,
} from "./lifecycle";
import { applyPlotTransitionEffects } from "./transition-effects";
import { canLinkDeviceToPlot } from "@/lib/devices/plot-eligibility";

const ALL_PLOT_STATUSES: PlotStatus[] = [
  "PREPARING",
  "PLANTED",
  "GROWING",
  "READY_FOR_HARVEST",
  "HARVESTED",
  "FALLOW",
  "ARCHIVED",
];

test("SETUP, OPERATIONAL, and HISTORICAL are mutually exclusive", () => {
  const classes = [
    SETUP_PLOT_STATUSES,
    OPERATIONAL_PLOT_STATUSES,
    HISTORICAL_PLOT_STATUSES,
  ];
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const overlap = classes[i].filter((status) => classes[j].includes(status));
      assert.deepEqual(overlap, []);
    }
  }
});

test("SETUP, OPERATIONAL, and HISTORICAL union to every PlotStatus member", () => {
  const union = [
    ...SETUP_PLOT_STATUSES,
    ...OPERATIONAL_PLOT_STATUSES,
    ...HISTORICAL_PLOT_STATUSES,
  ].sort();
  assert.deepEqual(union, [...ALL_PLOT_STATUSES].sort());
});

test("ACTIVITY_PLOT_STATUSES equals SETUP + OPERATIONAL", () => {
  assert.deepEqual(
    [...ACTIVITY_PLOT_STATUSES].sort(),
    [...SETUP_PLOT_STATUSES, ...OPERATIONAL_PLOT_STATUSES].sort()
  );
});

test("isActivityPlotStatus classifies activity and historical statuses", () => {
  for (const status of ACTIVITY_PLOT_STATUSES) {
    assert.equal(isActivityPlotStatus(status), true);
  }
  for (const status of HISTORICAL_PLOT_STATUSES) {
    assert.equal(isActivityPlotStatus(status), false);
  }
});

test("isOperationalPlotStatus classifies only operational statuses", () => {
  assert.equal(isOperationalPlotStatus("PREPARING"), false);
  for (const status of OPERATIONAL_PLOT_STATUSES) {
    assert.equal(isOperationalPlotStatus(status), true);
  }
  for (const status of HISTORICAL_PLOT_STATUSES) {
    assert.equal(isOperationalPlotStatus(status), false);
  }
});

test("isHistoricalPlotStatus classifies historical statuses", () => {
  assert.equal(isHistoricalPlotStatus("PREPARING"), false);
  for (const status of OPERATIONAL_PLOT_STATUSES) {
    assert.equal(isHistoricalPlotStatus(status), false);
  }
  for (const status of HISTORICAL_PLOT_STATUSES) {
    assert.equal(isHistoricalPlotStatus(status), true);
  }
});

test("canLinkDeviceToPlot enforces create and edit lifecycle eligibility", () => {
  for (const status of ACTIVITY_PLOT_STATUSES) {
    assert.equal(
      canLinkDeviceToPlot({ plotStatus: status, targetPlotId: "activity" }),
      true
    );
  }

  for (const status of HISTORICAL_PLOT_STATUSES) {
    assert.equal(
      canLinkDeviceToPlot({ plotStatus: status, targetPlotId: "historical" }),
      false
    );
    assert.equal(
      canLinkDeviceToPlot({
        plotStatus: status,
        targetPlotId: "current",
        currentPlotId: "current",
      }),
      true
    );
    assert.equal(
      canLinkDeviceToPlot({
        plotStatus: status,
        targetPlotId: "different",
        currentPlotId: "current",
      }),
      false
    );
  }
});

function createTransitionClient() {
  const assignmentUpdates: unknown[] = [];
  const alertUpdates: unknown[] = [];

  return {
    assignmentUpdates,
    alertUpdates,
    client: {
      plotAssignment: {
        updateMany: async (args: unknown) => {
          assignmentUpdates.push(args);
          return { count: 1 };
        },
      },
      alert: {
        updateMany: async (args: unknown) => {
          alertUpdates.push(args);
          return { count: 1 };
        },
      },
    },
  };
}

test("applyPlotTransitionEffects completes active assignments for historical destinations", async () => {
  const transitionedAt = new Date("2026-09-12T00:00:00.000Z");

  for (const nextStatus of HISTORICAL_PLOT_STATUSES) {
    const { client, assignmentUpdates } = createTransitionClient();
    const effects = await applyPlotTransitionEffects({
      client,
      plotId: "plot-1",
      previousStatus: "GROWING",
      nextStatus,
      transitionedAt,
    });

    assert.equal(effects.completedAssignments, true);
    assert.deepEqual(assignmentUpdates, [
      {
        where: { plotId: "plot-1", status: "ACTIVE" },
        data: { status: "COMPLETED", endedAt: transitionedAt },
      },
    ]);
  }
});

test("applyPlotTransitionEffects closes alerts when operational monitoring stops", async () => {
  const transitionedAt = new Date("2026-09-12T00:00:00.000Z");
  const nonOperationalStatuses: PlotStatus[] = [
    "PREPARING",
    ...HISTORICAL_PLOT_STATUSES,
  ];

  for (const nextStatus of nonOperationalStatuses) {
    const { client, alertUpdates } = createTransitionClient();
    const effects = await applyPlotTransitionEffects({
      client,
      plotId: "plot-1",
      previousStatus: "PLANTED",
      nextStatus,
      transitionedAt,
    });

    assert.equal(effects.closedOpenAlerts, true);
    assert.deepEqual(alertUpdates, [
      {
        where: { plotId: "plot-1", resolved: false },
        data: { resolved: true, resolvedAt: transitionedAt },
      },
    ]);
  }
});

test("applyPlotTransitionEffects does not resurrect assignments or alerts", async () => {
  const { client, assignmentUpdates, alertUpdates } = createTransitionClient();
  const effects = await applyPlotTransitionEffects({
    client,
    plotId: "plot-1",
    previousStatus: "HARVESTED",
    nextStatus: "GROWING",
    transitionedAt: new Date("2026-09-12T00:00:00.000Z"),
  });

  assert.deepEqual(effects, {
    completedAssignments: false,
    closedOpenAlerts: false,
  });
  assert.deepEqual(assignmentUpdates, []);
  assert.deepEqual(alertUpdates, []);
});
