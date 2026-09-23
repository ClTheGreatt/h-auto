import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PresetProvenancePanel } from "@/components/crops/preset-provenance-panel";
import { cropSchema } from "@/lib/validations/crop";
import { toCustomPreset } from "./custom-presets";
import {
  getPresetLoadValues,
  getPresetSelectionKind,
  isSafeReferenceUrl,
  NONE_PRESET_ID,
  PARAMETER_BASIS,
  resolvePresetSelection,
  showsPresetQuickStart,
} from "./preset-provenance";
import { CROP_PRESETS, type CropPreset } from "./presets";

const OPERATIONAL_FIELDS = [
  "name",
  "durationDays",
  "minSoilMoisture",
  "maxSoilMoisture",
  "minTemperature",
  "maxTemperature",
  "minHumidity",
  "maxHumidity",
  "minLightIntensity",
  "maxLightIntensity",
  "minNitrogen",
  "maxNitrogen",
  "minPhosphorus",
  "maxPhosphorus",
  "minPotassium",
  "maxPotassium",
] as const;

const EXPECTED_OPERATIONAL_HASH =
  "5b050320d4f430d59fe77d052f86c64888877e79f8d84b4be7fb05efbb8d6cec";

function operationalSnapshot() {
  return CROP_PRESETS.map((preset) => ({
    id: preset.id,
    daysToHarvest: preset.daysToHarvest,
    stages: preset.stages.map((stage) =>
      Object.fromEntries(
        OPERATIONAL_FIELDS.map((field) => [field, stage[field]])
      )
    ),
  }));
}

function customPreset(): CropPreset {
  return toCustomPreset({
    id: "custom-crop-1",
    name: "Faculty Tomato",
    variety: "Trial A",
    daysToHarvest: 80,
    description: "Administrator profile",
    cultivationGuide: "Review locally.",
    stages: [
      {
        name: "Seedling",
        durationDays: 10,
        description: null,
        expectedAppearance: null,
        observableSigns: [],
        facultyGuidance: null,
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
      },
    ],
  });
}

test("A-B. all nine built-ins have complete, safe reference provenance", () => {
  assert.equal(CROP_PRESETS.length, 9);

  for (const preset of CROP_PRESETS) {
    assert.equal(preset.provenance?.kind, "REFERENCE_REVIEWED");
    assert.ok(preset.provenance.summary.trim());
    assert.ok(preset.provenance.references.length >= 1);

    for (const reference of preset.provenance.references) {
      assert.ok(reference.organization.trim());
      assert.ok(reference.title.trim());
      assert.ok(reference.scope.length >= 1);
      if (reference.url) assert.equal(isSafeReferenceUrl(reference.url), true);
    }
  }
});

test("C. final built-in references use official Philippine ATI sources", () => {
  for (const preset of CROP_PRESETS) {
    for (const reference of preset.provenance?.references ?? []) {
      assert.match(
        reference.organization,
        /^Department of Agriculture - Agricultural Training Institute, /
      );
      assert.equal(new URL(reference.url!).hostname, "ati2.da.gov.ph");
    }
  }
});

test("D. provenance copy makes no official or DA-approved threshold claim", () => {
  const copy = CROP_PRESETS.map((preset) => preset.provenance?.summary).join(" ");
  const renderedPanels = CROP_PRESETS.map((preset) =>
    renderToStaticMarkup(<PresetProvenancePanel preset={preset} />)
  ).join(" ");

  assert.doesNotMatch(
    `${copy} ${renderedPanels}`,
    /DA-approved|official threshold|reference-backed|reference-guided|directly sourced|based on DA|DA-based/i
  );
  assert.match(copy, /configurable system defaults/i);
  assert.match(
    renderedPanels,
    /not direct values prescribed by the cited publication/i
  );
});

test("built-in Eggplant renders a Philippine cultivation reference", () => {
  const eggplant = resolvePresetSelection("eggplant", CROP_PRESETS, []);
  const html = renderToStaticMarkup(<PresetProvenancePanel preset={eggplant} />);

  assert.match(html, /Eggplant \(Talong\)/);
  assert.match(html, /Built-in preset · Philippine cultivation reference/);
  assert.match(html, /Gabay sa Pagtatanim ng Talong/);
  assert.match(html, /View cultivation reference/);
  assert.match(html, /configurable system defaults/);
  assert.match(html, /not direct values prescribed by the cited publication/);
});

test("D. a custom preset renders administrator-defined copy without references", () => {
  const preset = customPreset();
  const html = renderToStaticMarkup(<PresetProvenancePanel preset={preset} />);

  assert.equal(getPresetSelectionKind(preset), "CUSTOM");
  assert.match(html, /Custom preset · Administrator-defined values/);
  assert.doesNotMatch(html, /Philippine cultivation reference/);
  assert.doesNotMatch(html, /Open reference/);
});

test("E. manual entry renders no provenance panel", () => {
  assert.equal(getPresetSelectionKind(null), "MANUAL");
  assert.equal(renderToStaticMarkup(<PresetProvenancePanel preset={null} />), "");
});

test("F-G. switching built-ins updates the basis and None removes it", () => {
  const eggplant = resolvePresetSelection("eggplant", CROP_PRESETS, []);
  const okra = resolvePresetSelection("okra", CROP_PRESETS, []);
  const manual = resolvePresetSelection(NONE_PRESET_ID, CROP_PRESETS, []);

  const eggplantHtml = renderToStaticMarkup(
    <PresetProvenancePanel preset={eggplant} />
  );
  const okraHtml = renderToStaticMarkup(<PresetProvenancePanel preset={okra} />);

  assert.match(eggplantHtml, /Gabay sa Pagtatanim ng Talong/);
  assert.doesNotMatch(eggplantHtml, /Gabay sa Pagtatanim ng Okra/);
  assert.match(okraHtml, /Gabay sa Pagtatanim ng Okra/);
  assert.doesNotMatch(okraHtml, /Okra Production/);
  assert.doesNotMatch(okraHtml, /Gabay sa Pagtatanim ng Talong/);
  assert.equal(renderToStaticMarkup(<PresetProvenancePanel preset={manual} />), "");
});

test("H-I. all pre-feature operational preset values remain exact", () => {
  const snapshot = JSON.stringify(operationalSnapshot());
  assert.equal(CROP_PRESETS.reduce((count, preset) => count + preset.stages.length, 0), 33);
  assert.equal(createHash("sha256").update(snapshot).digest("hex"), EXPECTED_OPERATIONAL_HASH);
});

test("J-K. loaded values remain editable and provenance never enters form data", () => {
  const preset = CROP_PRESETS[0];
  const originalMinimum = preset.stages[0].minTemperature;
  const loaded = getPresetLoadValues(preset);

  loaded.name = "Edited Eggplant";
  loaded.stages[0].minTemperature = originalMinimum + 1;

  assert.equal(preset.name, "Eggplant");
  assert.equal(preset.stages[0].minTemperature, originalMinimum);
  assert.equal("provenance" in loaded, false);

  const parsed = cropSchema.parse({
    ...loaded,
    variety: "",
    provenance: preset.provenance,
  });
  assert.equal(parsed.name, "Edited Eggplant");
  assert.equal("provenance" in parsed, false);
});

test("L. custom preset conversion cannot copy built-in provenance", () => {
  const preset = customPreset();
  assert.equal("provenance" in preset, false);
  assert.equal(getPresetSelectionKind(preset), "CUSTOM");
});

test("M. every rendered external reference uses safe new-tab attributes", () => {
  for (const preset of CROP_PRESETS) {
    const html = renderToStaticMarkup(<PresetProvenancePanel preset={preset} />);
    const linkCount = (html.match(/<a /g) ?? []).length;
    assert.equal(linkCount, preset.provenance?.references.length);
    assert.equal((html.match(/target="_blank"/g) ?? []).length, linkCount);
    assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length, linkCount);
    assert.doesNotMatch(html, /javascript:|data:/i);
  }
});

test("N. provenance Quick Start is create-only, never inferred on Edit Crop", () => {
  assert.equal(showsPresetQuickStart("create"), true);
  assert.equal(showsPresetQuickStart("edit"), false);
});

test("O. compact responsive markup uses semantic lists and no overflow table", () => {
  const html = renderToStaticMarkup(
    <PresetProvenancePanel preset={CROP_PRESETS[0]} />
  );
  assert.match(html, /^<section/);
  assert.match(html, /<details/);
  assert.match(html, /<ul[^>]*>[\s\S]*<li/);
  assert.doesNotMatch(html, /<table/);
});

test("parameter basis wording matches the defensible classification", () => {
  assert.equal(PARAMETER_BASIS.Temperature.label, "Configurable monitoring range");
  assert.equal(PARAMETER_BASIS.Humidity.label, "Configurable monitoring range");
  assert.equal(PARAMETER_BASIS.SoilMoisture.label, "Field-adjustable");
  assert.equal(PARAMETER_BASIS.LightIntensity.label, "Monitoring reference");
  assert.equal(PARAMETER_BASIS.Nitrogen.label, "Soil-test adjustable");
  assert.equal(PARAMETER_BASIS.Phosphorus.label, "Soil-test adjustable");
  assert.equal(PARAMETER_BASIS.Potassium.label, "Soil-test adjustable");
});
