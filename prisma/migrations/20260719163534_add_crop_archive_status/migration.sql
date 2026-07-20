-- CreateEnum
CREATE TYPE "CropStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable: existing rows default to ACTIVE, archivedAt null until archived
ALTER TABLE "Crop" ADD COLUMN "status" "CropStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Crop" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Crop_status_idx" ON "Crop"("status");
