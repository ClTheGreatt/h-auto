ALTER TABLE "CropStage"
  ADD COLUMN "referenceImageUrl" TEXT,
  ADD COLUMN "referenceImagePublicId" TEXT,
  ADD COLUMN "expectedAppearance" TEXT,
  ADD COLUMN "observableSigns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "facultyGuidance" TEXT;
