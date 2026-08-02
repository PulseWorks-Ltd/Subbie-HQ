-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'quote';

-- AlterTable
ALTER TABLE "ContractTerms" ADD COLUMN "suggestedMaterialsMarkupPercent" DOUBLE PRECISION,
ADD COLUMN "suggestedDayWorksRateNormal" DECIMAL(10,2),
ADD COLUMN "suggestedDayWorksRateNight" DECIMAL(10,2),
ADD COLUMN "suggestedDayWorksRateSundayHoliday" DECIMAL(10,2),
ADD COLUMN "suggestedDayWorksRateNotes" TEXT;

-- CreateTable
CREATE TABLE "ProjectQuote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "quotedValue" DECIMAL(12,2),
    "quotedDate" TIMESTAMP(3),
    "scopeSummary" TEXT,
    "lineItems" JSONB,
    "commercialNotes" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectQuote_projectId_key" ON "ProjectQuote"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectQuote" ADD CONSTRAINT "ProjectQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuote" ADD CONSTRAINT "ProjectQuote_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
