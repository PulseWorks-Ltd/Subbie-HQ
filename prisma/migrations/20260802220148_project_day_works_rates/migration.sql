-- AlterTable
ALTER TABLE "ContractTerms" ADD COLUMN "materialsMarkupPercent" DOUBLE PRECISION,
ADD COLUMN "dayWorksRateNormal" DECIMAL(10,2),
ADD COLUMN "dayWorksRateNight" DECIMAL(10,2),
ADD COLUMN "dayWorksRateSundayHoliday" DECIMAL(10,2);
