import assert from "node:assert/strict";
import test from "node:test";
import { toCustomPreset } from "./custom-presets";
import {
  getStageReferencePresentation,
  hasStageReferenceGuide,
  stageReferenceAlt,
  type StageReferenceGuide,
} from "./stage-reference";
import { cropSchema } from "../validations/crop";

const thresholds = {
  minSoilMoisture: 40,
  maxSoilMoisture: 60,
  minTemperature: 20,
  maxTemperature: 30,
  minHumidity: 50,
  maxHumidity: 80,
  minLightIntensity: 100,
  maxLightIntensity: 500,
  minNitrogen: 10,
  maxNitrogen: 20,
  minPhosphorus: 10,
  maxPhosphorus: 20,
  minPotassium: 10,
  maxPotassium: 20,
};

function cropInput(stageOverrides: Record<string, unknown> = {}) {
  return {
    name: "Tomato",
    daysToHarvest: 80,
    stages: [
      {
        name: "Seedling",
        orderIndex: 0,
        durationDays: 10,
        description: "Young plant",
        ...thresholds,
        ...stageOverrides,
      },
    ],
  };
}

function customPresetSource(stageOverrides: Record<string, unknown> = {}) {
  return {
    id: "crop-1",
    name: "Tomato",
    variety: null,
    daysToHarvest: 80,
    description: null,
    cultivationGuide: null,
    stages: [
      {
        name: "Seedling",
        durationDays: 10,
        description: null,
        expectedAppearance: null,
        observableSigns: [],
        facultyGuidance: null,
        ...thresholds,
        ...stageOverrides,
      },
    ],
  };
}

const emptyGuide: StageReferenceGuide = {
  referenceImageUrl: null,
  expectedAppearance: null,
  observableSigns: [],
  facultyGuidance: null,
};

test("1. a legacy stage without guide fields remains valid", () => {
  const parsed = cropSchema.safeParse(cropInput());
  assert.equal(parsed.success, true);
});

test("2. expected appearance is optional and trimmed", () => {
  const parsed = cropSchema.parse(cropInput({ expectedAppearance: "  Two leaves  " }));
  assert.equal(parsed.stages[0].expectedAppearance, "Two leaves");
});

test("3. observable signs are trimmed", () => {
  const parsed = cropSchema.parse(cropInput({ observableSigns: ["  Firm stem ", " Green leaves "] }));
  assert.deepEqual(parsed.stages[0].observableSigns, ["Firm stem", "Green leaves"]);
});

test("4. empty observable-sign lines are removed", () => {
  const parsed = cropSchema.parse(cropInput({ observableSigns: ["", "  ", "Visible roots"] }));
  assert.deepEqual(parsed.stages[0].observableSigns, ["Visible roots"]);
});

test("5. no more than ten non-empty signs are accepted", () => {
  const parsed = cropSchema.safeParse(
    cropInput({ observableSigns: Array.from({ length: 11 }, (_, index) => `Sign ${index}`) })
  );
  assert.equal(parsed.success, false);
});

test("6. stage guide text length limits are enforced", () => {
  assert.equal(
    cropSchema.safeParse(cropInput({ expectedAppearance: "x".repeat(1501) })).success,
    false
  );
  assert.equal(
    cropSchema.safeParse(cropInput({ facultyGuidance: "x".repeat(1501) })).success,
    false
  );
  assert.equal(
    cropSchema.safeParse(cropInput({ observableSigns: ["x".repeat(251)] })).success,
    false
  );
});

test("7. a custom preset copies reference text and signs", () => {
  const preset = toCustomPreset(
    customPresetSource({
      expectedAppearance: "Two true leaves",
      observableSigns: ["Upright stem"],
      facultyGuidance: "Compare leaf color",
    })
  );
  assert.equal(preset.stages[0].expectedAppearance, "Two true leaves");
  assert.deepEqual(preset.stages[0].observableSigns, ["Upright stem"]);
  assert.equal(preset.stages[0].facultyGuidance, "Compare leaf color");
});

test("8. a custom preset never exposes image ownership fields", () => {
  const source = customPresetSource({
    referenceImageUrl: "https://example.com/reference.jpg",
    referenceImagePublicId: "h-auto/stage-references/reference",
  });
  const preset = toCustomPreset(source);
  assert.equal("referenceImageUrl" in preset.stages[0], false);
  assert.equal("referenceImagePublicId" in preset.stages[0], false);
  const parsed = cropSchema.parse(
    cropInput({
      referenceImageUrl: "https://example.com/reference.jpg",
      referenceImagePublicId: "h-auto/stage-references/reference",
    })
  );
  assert.equal("referenceImageUrl" in parsed.stages[0], false);
  assert.equal("referenceImagePublicId" in parsed.stages[0], false);
});

test("9. null custom-preset guide values normalize to empty form values", () => {
  const stage = toCustomPreset(customPresetSource()).stages[0];
  assert.equal(stage.expectedAppearance, "");
  assert.deepEqual(stage.observableSigns, []);
  assert.equal(stage.facultyGuidance, "");
});

test("31. an empty guide does not request a reference card", () => {
  assert.equal(hasStageReferenceGuide(emptyGuide), false);
});

test("32. a text-only guide produces a clean text presentation", () => {
  const presentation = getStageReferencePresentation("Tomato", "Seedling", {
    ...emptyGuide,
    expectedAppearance: "  Compact green leaves  ",
  });
  assert.equal(presentation.showCard, true);
  assert.equal(presentation.showImage, false);
  assert.equal(presentation.expectedAppearance, "Compact green leaves");
});

test("33. an image-only guide requests the reference image card", () => {
  const presentation = getStageReferencePresentation("Tomato", "Seedling", {
    ...emptyGuide,
    referenceImageUrl: "https://example.com/reference.jpg",
  });
  assert.equal(presentation.showCard, true);
  assert.equal(presentation.showImage, true);
});

test("34. a full guide retains every presentation section", () => {
  const presentation = getStageReferencePresentation("Tomato", "Seedling", {
    referenceImageUrl: "https://example.com/reference.jpg",
    expectedAppearance: "Green leaves",
    observableSigns: ["Firm stem"],
    facultyGuidance: "Inspect daily",
  });
  assert.equal(presentation.showImage, true);
  assert.equal(presentation.expectedAppearance, "Green leaves");
  assert.deepEqual(presentation.observableSigns, ["Firm stem"]);
  assert.equal(presentation.facultyGuidance, "Inspect daily");
});

test("35. a no-image guide does not request an empty image frame", () => {
  const presentation = getStageReferencePresentation("Tomato", "Seedling", {
    ...emptyGuide,
    facultyGuidance: "Inspect daily",
  });
  assert.equal(presentation.showCard, true);
  assert.equal(presentation.showImage, false);
  assert.equal(presentation.imageUrl, null);
});

test("36. image alternative text is deterministic", () => {
  assert.equal(
    stageReferenceAlt("Tomato", "Seedling"),
    "Tomato — Seedling stage reference"
  );
});

test("37. observable signs are normalized for bullet rendering", () => {
  const presentation = getStageReferencePresentation("Tomato", "Seedling", {
    ...emptyGuide,
    observableSigns: ["  First sign ", "", "Second sign"],
  });
  assert.deepEqual(presentation.observableSigns, ["First sign", "Second sign"]);
});
