import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CropPreset } from "@/lib/crops/presets";
import {
  getPresetSelectionKind,
  isSafeReferenceUrl,
  PARAMETER_BASIS,
} from "@/lib/crops/preset-provenance";

type PresetProvenancePanelProps = {
  preset: CropPreset | null;
};

const BASIS_GROUPS = [
  {
    parameters: "Temperature and humidity",
    ...PARAMETER_BASIS.Temperature,
  },
  {
    parameters: "Soil moisture",
    ...PARAMETER_BASIS.SoilMoisture,
  },
  {
    parameters: "Light intensity",
    ...PARAMETER_BASIS.LightIntensity,
  },
  {
    parameters: "Nitrogen, phosphorus, and potassium",
    ...PARAMETER_BASIS.Nitrogen,
  },
] as const;

export function PresetProvenancePanel({ preset }: PresetProvenancePanelProps) {
  const kind = getPresetSelectionKind(preset);

  if (!preset || kind === "MANUAL") return null;

  if (kind === "CUSTOM") {
    return (
      <section
        aria-label={`${preset.displayName} preset information`}
        className="rounded-lg border bg-muted/40 p-4"
        data-preset-provenance="custom"
      >
        <p className="font-medium text-foreground">{preset.displayName}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Custom preset · Administrator-defined values
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This preset was saved from an H-Auto crop profile. Review the values
          before creating the new crop.
        </p>
      </section>
    );
  }

  const provenance = preset.provenance;
  if (!provenance || provenance.kind !== "REFERENCE_REVIEWED") return null;

  return (
    <section
      aria-label={`${preset.displayName} Philippine cultivation reference`}
      className="rounded-lg border border-primary/20 bg-primary/5 p-4"
      data-preset-provenance="built-in"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{preset.displayName}</p>
          <p className="mt-1 text-sm font-medium text-primary">
            Built-in preset · Philippine cultivation reference
          </p>
        </div>
        <Badge variant="outline">Starting profile</Badge>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        H-Auto provides configurable stage-based monitoring defaults. The cited
        publication supplies Philippine crop-production and cultivation context.
      </p>

      <details className="group mt-3">
        <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          View cultivation reference
        </summary>

        <div className="mt-3 space-y-4 border-t pt-3 text-sm">
          <div>
            <h3 className="font-medium text-foreground">
              Philippine crop cultivation reference
            </h3>
            <p className="mt-1 text-muted-foreground">{provenance.summary}</p>
          </div>

          <ul className="space-y-3" aria-label="Philippine cultivation references">
            {provenance.references.map((reference) => (
              <li
                key={`${reference.organization}:${reference.title}`}
                className="rounded-md border bg-background p-3"
              >
                <p className="font-medium text-foreground">
                  {reference.organization}
                </p>
                <p className="mt-0.5 text-muted-foreground">{reference.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cultivation coverage: {reference.scope.join(", ")}
                </p>
                {reference.url && isSafeReferenceUrl(reference.url) ? (
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Open ${reference.title} reference in a new tab`}
                  >
                    Open reference
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>

          <div>
            <h3 className="font-medium text-foreground">
              How H-Auto uses this reference
            </h3>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BASIS_GROUPS.map((basis) => (
                <div key={basis.parameters} className="rounded-md bg-muted/60 p-2.5">
                  <dt className="font-medium text-foreground">
                    {basis.parameters} · {basis.label}
                  </dt>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {basis.explanation}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-1 rounded-md border border-border/70 bg-background p-3 text-xs text-muted-foreground">
            <p>
              Sensor threshold note: The min/max monitoring values in H-Auto are
              configurable system defaults and are not direct values prescribed
              by the cited publication.
            </p>
            <p>
              Actual crop conditions may vary by variety, soil condition, growth
              stage, sensor calibration, and local growing conditions.
            </p>
            <p>
              Soil nutrient ranges should be interpreted with local soil-test
              results and faculty or agricultural-extension recommendations.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
