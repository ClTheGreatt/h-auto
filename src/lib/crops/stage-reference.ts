export type StageReferenceGuide = {
  referenceImageUrl: string | null;
  expectedAppearance: string | null;
  observableSigns: string[];
  facultyGuidance: string | null;
};

export function hasStageReferenceGuide(guide: StageReferenceGuide): boolean {
  return Boolean(
    guide.referenceImageUrl ||
      guide.expectedAppearance?.trim() ||
      guide.observableSigns.some((sign) => sign.trim().length > 0) ||
      guide.facultyGuidance?.trim()
  );
}

export function stageReferenceAlt(cropName: string, stageName: string): string {
  return `${cropName} — ${stageName} stage reference`;
}

export function getStageReferencePresentation(
  cropName: string,
  stageName: string,
  guide: StageReferenceGuide
) {
  const observableSigns = guide.observableSigns
    .map((sign) => sign.trim())
    .filter(Boolean);
  return {
    showCard: hasStageReferenceGuide(guide),
    showImage: Boolean(guide.referenceImageUrl),
    imageUrl: guide.referenceImageUrl,
    imageAlt: guide.referenceImageUrl
      ? stageReferenceAlt(cropName, stageName)
      : null,
    expectedAppearance: guide.expectedAppearance?.trim() || null,
    observableSigns,
    facultyGuidance: guide.facultyGuidance?.trim() || null,
  };
}
