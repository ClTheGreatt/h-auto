"use client";

import Image from "next/image";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStageReferencePresentation } from "@/lib/crops/stage-reference";

type StageReferenceCardProps = {
  cropName: string;
  stage: {
    name: string;
    durationDays: number;
    referenceImageUrl: string | null;
    expectedAppearance: string | null;
    observableSigns: string[];
    facultyGuidance: string | null;
  };
};

export function StageReferenceCard({ cropName, stage }: StageReferenceCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const guide = getStageReferencePresentation(cropName, stage.name, stage);
  const imageFailed = failedImageUrl === guide.imageUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-5" />
          Growth Stage Reference
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="font-medium">{stage.name}</h3>
          <p className="text-sm text-muted-foreground">
            Typical duration: {stage.durationDays} {stage.durationDays === 1 ? "day" : "days"}
          </p>
        </div>

        {guide.showImage && guide.imageUrl && guide.imageAlt ? (
          <div className="max-w-xl space-y-2">
            {!imageFailed ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted/30">
                <Image
                  src={guide.imageUrl}
                  alt={guide.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 576px"
                  className="object-contain"
                  onError={() => setFailedImageUrl(guide.imageUrl ?? undefined)}
                />
              </div>
            ) : (
              <div className="rounded-md border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Reference image is currently unavailable.
              </div>
            )}
            <p className="text-xs text-muted-foreground">Reference image</p>
          </div>
        ) : null}

        {guide.expectedAppearance ? (
          <section>
            <h3 className="text-sm font-medium">Expected appearance</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {guide.expectedAppearance}
            </p>
          </section>
        ) : null}

        {guide.observableSigns.length > 0 ? (
          <section>
            <h3 className="text-sm font-medium">Observable signs</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {guide.observableSigns.map((sign, index) => (
                <li key={`${index}-${sign}`}>{sign}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {guide.facultyGuidance ? (
          <section>
            <h3 className="text-sm font-medium">Faculty guidance</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {guide.facultyGuidance}
            </p>
          </section>
        ) : null}

        <p className="border-t pt-4 text-xs text-muted-foreground">
          Use this as a visual guide. Actual appearance may vary by variety and growing
          conditions.
        </p>
      </CardContent>
    </Card>
  );
}
