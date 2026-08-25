-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "variationAutomationSetByUserId" TEXT;

-- AlterTable
ALTER TABLE "VariationPackage" ADD COLUMN     "scheduleRunId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_variationAutomationSetByUserId_fkey" FOREIGN KEY ("variationAutomationSetByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationPackage" ADD CONSTRAINT "VariationPackage_scheduleRunId_fkey" FOREIGN KEY ("scheduleRunId") REFERENCES "VariationScheduleRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
