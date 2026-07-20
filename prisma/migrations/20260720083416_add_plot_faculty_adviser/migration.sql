-- AlterTable
ALTER TABLE "Plot" ADD COLUMN     "facultyId" TEXT;

-- CreateIndex
CREATE INDEX "Plot_facultyId_idx" ON "Plot"("facultyId");

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
