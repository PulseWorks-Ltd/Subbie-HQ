-- AlterTable
ALTER TABLE "ExternalAction" ADD COLUMN     "hoursOnSiteSheetId" TEXT;

-- AlterTable
ALTER TABLE "HoursOnSiteSheet" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByExternalActionId" TEXT,
ADD COLUMN     "approvedByName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HoursOnSiteSheet_approvedByExternalActionId_key" ON "HoursOnSiteSheet"("approvedByExternalActionId");

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_hoursOnSiteSheetId_fkey" FOREIGN KEY ("hoursOnSiteSheetId") REFERENCES "HoursOnSiteSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursOnSiteSheet" ADD CONSTRAINT "HoursOnSiteSheet_approvedByExternalActionId_fkey" FOREIGN KEY ("approvedByExternalActionId") REFERENCES "ExternalAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
