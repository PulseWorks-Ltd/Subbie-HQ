-- CreateEnum
CREATE TYPE "CommercialReviewPendingReason" AS ENUM ('unassigned', 'awaiting_percentage');

-- CreateEnum
CREATE TYPE "CommercialReviewStatus" AS ENUM ('pending_review', 'no_action_required');

-- CreateTable
CREATE TABLE "CommercialReviewItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "pendingReason" "CommercialReviewPendingReason" NOT NULL,
    "status" "CommercialReviewStatus" NOT NULL DEFAULT 'pending_review',
    "aiSummary" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "detectionError" TEXT,
    "detectedAt" TIMESTAMP(3),
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "hasAdditionalWorkLanguage" BOOLEAN NOT NULL DEFAULT false,
    "hasRelatedCorrespondence" BOOLEAN NOT NULL DEFAULT false,
    "noActionByUserId" TEXT,
    "noActionAt" TIMESTAMP(3),
    "noActionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialReviewItem_updateId_key" ON "CommercialReviewItem"("updateId");

-- CreateIndex
CREATE INDEX "CommercialReviewItem_projectId_status_idx" ON "CommercialReviewItem"("projectId", "status");

-- CreateIndex
CREATE INDEX "CommercialReviewItem_status_pendingReason_createdAt_idx" ON "CommercialReviewItem"("status", "pendingReason", "createdAt");

-- AddForeignKey
ALTER TABLE "CommercialReviewItem" ADD CONSTRAINT "CommercialReviewItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialReviewItem" ADD CONSTRAINT "CommercialReviewItem_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialReviewItem" ADD CONSTRAINT "CommercialReviewItem_noActionByUserId_fkey" FOREIGN KEY ("noActionByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
