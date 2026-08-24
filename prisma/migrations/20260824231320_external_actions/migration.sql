-- CreateEnum
CREATE TYPE "ExternalActionType" AS ENUM ('acknowledge', 'approve', 'sign', 'confirm', 'reject', 'comment');

-- CreateEnum
CREATE TYPE "ExternalActionStatus" AS ENUM ('pending', 'responded', 'expired');

-- CreateEnum
CREATE TYPE "ExternalActionChoice" AS ENUM ('approved', 'rejected');

-- AlterEnum
ALTER TYPE "CorrespondenceSource" ADD VALUE 'external_action';

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "sourceExternalActionId" TEXT;

-- CreateTable
CREATE TABLE "ExternalAction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variationItemId" TEXT,
    "dayWorksSheetId" TEXT,
    "type" "ExternalActionType" NOT NULL,
    "message" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ExternalActionStatus" NOT NULL DEFAULT 'pending',
    "mainContractorContactId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "sentByUserId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseChoice" "ExternalActionChoice",
    "responseName" TEXT,
    "responseComment" TEXT,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalActionLookupAttempt" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalActionLookupAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAction_tokenHash_key" ON "ExternalAction"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Correspondence_sourceExternalActionId_key" ON "Correspondence"("sourceExternalActionId");

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_sourceExternalActionId_fkey" FOREIGN KEY ("sourceExternalActionId") REFERENCES "ExternalAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_mainContractorContactId_fkey" FOREIGN KEY ("mainContractorContactId") REFERENCES "MainContractorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

