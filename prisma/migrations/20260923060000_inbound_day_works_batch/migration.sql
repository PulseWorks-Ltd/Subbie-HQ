-- CreateEnum
CREATE TYPE "InboundDayWorksExtractionStatus" AS ENUM ('extracting', 'ready_for_review', 'failed', 'completed');

-- CreateEnum
CREATE TYPE "InboundDayWorksMatchStatus" AS ENUM ('matched', 'likely_match', 'new', 'unresolved');

-- CreateEnum
CREATE TYPE "InboundDayWorksSheetAction" AS ENUM ('pending', 'match_existing', 'create_new', 'ignore');

-- CreateTable
CREATE TABLE "InboundDayWorksExtraction" (
    "id" TEXT NOT NULL,
    "inboundEmailId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "InboundDayWorksExtractionStatus" NOT NULL DEFAULT 'extracting',
    "extractionError" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InboundDayWorksExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundDayWorksExtractionSheet" (
    "id" TEXT NOT NULL,
    "inboundDayWorksExtractionId" TEXT NOT NULL,
    "inboundEmailAttachmentId" TEXT NOT NULL,
    "sheetIndexInAttachment" INTEGER NOT NULL,
    "sheetNumber" TEXT,
    "teamLeaderCount" INTEGER,
    "teamMemberCount" INTEGER,
    "totalHours" DECIMAL(6,2),
    "ratePerHour" DECIMAL(10,2),
    "date" TIMESTAMP(3),
    "startTime" TEXT,
    "finishTime" TEXT,
    "task" TEXT,
    "notes" TEXT,
    "weather" TEXT,
    "location" TEXT,
    "confidence" DOUBLE PRECISION,
    "extractedSiReference" TEXT,
    "matchStatus" "InboundDayWorksMatchStatus" NOT NULL DEFAULT 'unresolved',
    "matchedVariationItemId" TEXT,
    "matchReason" TEXT,
    "userAction" "InboundDayWorksSheetAction" NOT NULL DEFAULT 'pending',
    "newItemReference" TEXT,
    "newItemTitle" TEXT,
    "filedDayWorksSheetRecordId" TEXT,
    "filedAt" TIMESTAMP(3),
    "filedByUserId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundDayWorksExtractionSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundDayWorksExtraction_inboundEmailId_key" ON "InboundDayWorksExtraction"("inboundEmailId");

-- CreateIndex
CREATE INDEX "InboundDayWorksExtraction_projectId_idx" ON "InboundDayWorksExtraction"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundDayWorksExtractionSheet_filedDayWorksSheetRecordId_key" ON "InboundDayWorksExtractionSheet"("filedDayWorksSheetRecordId");

-- CreateIndex
CREATE INDEX "InboundDayWorksExtractionSheet_inboundDayWorksExtractionId_idx" ON "InboundDayWorksExtractionSheet"("inboundDayWorksExtractionId");

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtraction" ADD CONSTRAINT "InboundDayWorksExtraction_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtraction" ADD CONSTRAINT "InboundDayWorksExtraction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtraction" ADD CONSTRAINT "InboundDayWorksExtraction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtractionSheet" ADD CONSTRAINT "InboundDayWorksExtractionSheet_inboundDayWorksExtractionId_fkey" FOREIGN KEY ("inboundDayWorksExtractionId") REFERENCES "InboundDayWorksExtraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtractionSheet" ADD CONSTRAINT "InboundDayWorksExtractionSheet_inboundEmailAttachmentId_fkey" FOREIGN KEY ("inboundEmailAttachmentId") REFERENCES "InboundEmailAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtractionSheet" ADD CONSTRAINT "InboundDayWorksExtractionSheet_matchedVariationItemId_fkey" FOREIGN KEY ("matchedVariationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtractionSheet" ADD CONSTRAINT "InboundDayWorksExtractionSheet_filedDayWorksSheetRecordId_fkey" FOREIGN KEY ("filedDayWorksSheetRecordId") REFERENCES "DayWorksSheetRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDayWorksExtractionSheet" ADD CONSTRAINT "InboundDayWorksExtractionSheet_filedByUserId_fkey" FOREIGN KEY ("filedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

