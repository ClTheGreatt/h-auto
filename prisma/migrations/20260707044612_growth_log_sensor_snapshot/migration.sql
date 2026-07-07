-- AlterTable
ALTER TABLE "GrowthLog" ADD COLUMN     "humidity" DOUBLE PRECISION,
ADD COLUMN     "lightIntensity" DOUBLE PRECISION,
ADD COLUMN     "nitrogen" DOUBLE PRECISION,
ADD COLUMN     "phosphorus" DOUBLE PRECISION,
ADD COLUMN     "potassium" DOUBLE PRECISION,
ADD COLUMN     "sensorReadingId" TEXT,
ADD COLUMN     "soilMoisture" DOUBLE PRECISION,
ADD COLUMN     "temperature" DOUBLE PRECISION;
