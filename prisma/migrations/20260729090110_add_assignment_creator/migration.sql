-- AlterTable
ALTER TABLE "PlotAssignment" ADD COLUMN     "assignedById" TEXT;

-- AddForeignKey
ALTER TABLE "PlotAssignment" ADD CONSTRAINT "PlotAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
