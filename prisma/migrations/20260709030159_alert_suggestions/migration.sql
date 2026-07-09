-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "suggestionSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "suggestionTitle" TEXT;
