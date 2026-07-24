-- AlterTable
ALTER TABLE "User" ADD COLUMN     "academicYear" TEXT,
ADD COLUMN     "graduatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_academicYear_section_idx" ON "User"("academicYear", "section");
