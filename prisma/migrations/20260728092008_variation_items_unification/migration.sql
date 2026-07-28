-- CreateEnum
CREATE TYPE "VariationItemType" AS ENUM ('variation', 'site_instruction');

-- CreateEnum
CREATE TYPE "VariationItemStatus" AS ENUM ('draft', 'open', 'submitted_for_claim', 'complete');

-- CreateEnum
CREATE TYPE "CorrespondenceSource" AS ENUM ('upload', 'inbound_email');

-- CreateEnum
CREATE TYPE "VariationCompletionMode" AS ENUM ('auto', 'requires_confirmation');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "variationCompletionMode" "VariationCompletionMode" NOT NULL DEFAULT 'requires_confirmation';

-- AlterTable
ALTER TABLE "Update" ADD COLUMN     "percentComplete" DOUBLE PRECISION,
ADD COLUMN     "variationItemId" TEXT;

-- CreateTable
CREATE TABLE "VariationItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "VariationItemType" NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "VariationItemStatus" NOT NULL DEFAULT 'open',
    "percentComplete" DOUBLE PRECISION,
    "suggestedPercentComplete" DOUBLE PRECISION,
    "notifiedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "fileName" TEXT,
    "storageKey" TEXT,
    "quoteFileName" TEXT,
    "quoteStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayWorksSheet" (
    "id" TEXT NOT NULL,
    "variationItemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayWorksSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationPhoto" (
    "id" TEXT NOT NULL,
    "variationItemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variationItemId" TEXT,
    "title" TEXT NOT NULL,
    "fileName" TEXT,
    "storageKey" TEXT,
    "source" "CorrespondenceSource" NOT NULL DEFAULT 'upload',
    "inboundEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Correspondence_inboundEmailId_key" ON "Correspondence"("inboundEmailId");

-- DataMigration: copy every existing SiteInstruction row into VariationItem, reusing the
-- same id (so Update.siteInstructionId values remain valid VariationItem references with
-- no remapping needed). The old SiteInstruction table and Update.siteInstructionId column
-- are left in place after this — dropped only in a follow-up migration once the new
-- VariationItem model has been verified end-to-end.
INSERT INTO "VariationItem" ("id", "projectId", "type", "reference", "title", "description", "status", "notifiedAt", "dueAt", "fileName", "storageKey", "createdAt")
SELECT "id", "projectId", 'site_instruction', "reference", "title", "description",
  (CASE WHEN "status" = 'complete' THEN 'complete' ELSE 'open' END)::"VariationItemStatus",
  "notifiedAt", "dueAt", "fileName", "storageKey", "createdAt"
FROM "SiteInstruction";

-- DataMigration: backfill Update.variationItemId from the existing siteInstructionId —
-- valid because the VariationItem rows above were created with identical ids.
UPDATE "Update" SET "variationItemId" = "siteInstructionId" WHERE "siteInstructionId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Update" ADD CONSTRAINT "Update_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItem" ADD CONSTRAINT "VariationItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayWorksSheet" ADD CONSTRAINT "DayWorksSheet_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationPhoto" ADD CONSTRAINT "VariationPhoto_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
