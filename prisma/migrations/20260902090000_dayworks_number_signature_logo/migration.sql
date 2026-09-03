-- AlterTable
ALTER TABLE "HoursOnSiteSheet" ADD COLUMN     "dayWorksSheetNumber" SERIAL NOT NULL,
ADD COLUMN     "signatureImageStorageKey" TEXT;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "logoContentType" TEXT,
ADD COLUMN     "logoStorageKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HoursOnSiteSheet_dayWorksSheetNumber_key" ON "HoursOnSiteSheet"("dayWorksSheetNumber");
