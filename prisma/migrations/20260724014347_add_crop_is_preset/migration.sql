-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "isPreset" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Crop_isPreset_idx" ON "Crop"("isPreset");
