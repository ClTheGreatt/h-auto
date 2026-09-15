import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { mayBeActivePairUniqueConflict } from "./active-pair-conflict";

function uniqueError(target?: unknown) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: target === undefined ? undefined : { target },
  });
}

test("Active pair index name or exact columns can enter the pair-existence check", () => {
  assert.equal(mayBeActivePairUniqueConflict(uniqueError("PlotAssignment_active_plot_student_unique")), true);
  assert.equal(mayBeActivePairUniqueConflict(uniqueError(["plotId", "studentId"])), true);
  assert.equal(mayBeActivePairUniqueConflict(uniqueError()), true);
});

test("Identified unrelated unique targets and unrelated errors are never swallowed", () => {
  assert.equal(mayBeActivePairUniqueConflict(uniqueError(["id"])), false);
  assert.equal(mayBeActivePairUniqueConflict(uniqueError("PlotAssignment_pkey")), false);
  assert.equal(mayBeActivePairUniqueConflict(new Error("database unavailable")), false);
});
