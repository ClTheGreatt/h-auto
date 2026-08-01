import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlotStatus } from "@prisma/client";
import {
  SETUP_PLOT_STATUSES,
  OPERATIONAL_PLOT_STATUSES,
  HISTORICAL_PLOT_STATUSES,
  ACTIVITY_PLOT_STATUSES,
} from "./lifecycle";

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
