import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFacultyCohortScope } from "./assignable-students";

const BTVTED_ANIMAL = "BTVTEd - Animal Production";

test("Faculty scope is an exact Course + Section OR", () => {
  assert.deepEqual(
    buildFacultyCohortScope(BTVTED_ANIMAL, [
      { course: BTVTED_ANIMAL, section: "BTVTED-2B" },
      { course: BTVTED_ANIMAL, section: "BTVTED-3A" },
    ]),
    {
      OR: [
        { course: BTVTED_ANIMAL, section: "BTVTED-2B" },
        { course: BTVTED_ANIMAL, section: "BTVTED-3A" },
      ],
    }
  );
});

test("same Section in a different Course grants no Faculty scope", () => {
  assert.deepEqual(
    buildFacultyCohortScope(BTVTED_ANIMAL, [
      { course: "BS Agriculture - Crop Science", section: "3A" },
    ]),
    { id: { in: [] } }
  );
});

test("course=NULL legacy advisories grant no Faculty scope", () => {
  assert.deepEqual(
    buildFacultyCohortScope(BTVTED_ANIMAL, [
      { course: null, section: "BSA-3D" },
      { course: null, section: "BSA-4D" },
    ]),
    { id: { in: [] } }
  );
});

test("no resolved advisories returns an empty Faculty scope", () => {
  assert.deepEqual(buildFacultyCohortScope(BTVTED_ANIMAL, []), {
    id: { in: [] },
  });
});

test("null or noncanonical Faculty departments return an empty scope", () => {
  assert.deepEqual(buildFacultyCohortScope(null, []), { id: { in: [] } });
  assert.deepEqual(buildFacultyCohortScope("Unknown", []), {
    id: { in: [] },
  });
});
