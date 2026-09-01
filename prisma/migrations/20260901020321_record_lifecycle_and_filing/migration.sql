-- CreateEnum
CREATE TYPE "ClaimEvidenceType" AS ENUM ('variation_package', 'correspondence', 'external_action', 'qa_record', 'update');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'completed', 'closed');

-- CreateEnum
CREATE TYPE "RecordLifecycleEntityType" AS ENUM ('variation_item', 'task', 'project');

-- CreateEnum
CREATE TYPE "RecordLifecycleEventType" AS ENUM ('closed', 'reactivated', 'completed');

-- AlterTable
-- claimMonth added nullable first, backfilled from periodStart (the closest
-- existing date field), then made NOT NULL — safe even if a real row
-- somehow already exists (confirmed 0 rows in staging today; this model
-- has never had real UI, see this migration's accompanying schema comment).
ALTER TABLE "PaymentClaim" ADD COLUMN     "claimMonth" TEXT,
ADD COLUMN     "contractWorksAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "otherAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "otherDescription" TEXT;
UPDATE "PaymentClaim" SET "claimMonth" = to_char("periodStart", 'YYYY-MM') WHERE "claimMonth" IS NULL;
ALTER TABLE "PaymentClaim" ALTER COLUMN "claimMonth" SET NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedByUserId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VariationItem" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedByUserId" TEXT,
ADD COLUMN     "reactivatedAt" TIMESTAMP(3),
ADD COLUMN     "reactivatedByUserId" TEXT;

-- CreateTable
CREATE TABLE "VariationItemClaimAllocation" (
    "id" TEXT NOT NULL,
    "variationItemId" TEXT NOT NULL,
    "paymentClaimId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationItemClaimAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidenceLink" (
    "id" TEXT NOT NULL,
    "paymentClaimId" TEXT NOT NULL,
    "evidenceType" "ClaimEvidenceType" NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "variationItemId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordLifecycleEvent" (
    "id" TEXT NOT NULL,
    "entityType" "RecordLifecycleEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" "RecordLifecycleEventType" NOT NULL,
    "userId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VariationItemClaimAllocation_variationItemId_paymentClaimId_key" ON "VariationItemClaimAllocation"("variationItemId", "paymentClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimEvidenceLink_paymentClaimId_evidenceType_evidenceId_key" ON "ClaimEvidenceLink"("paymentClaimId", "evidenceType", "evidenceId");

-- CreateIndex
CREATE INDEX "RecordLifecycleEvent_entityType_entityId_createdAt_idx" ON "RecordLifecycleEvent"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItemClaimAllocation" ADD CONSTRAINT "VariationItemClaimAllocation_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItemClaimAllocation" ADD CONSTRAINT "VariationItemClaimAllocation_paymentClaimId_fkey" FOREIGN KEY ("paymentClaimId") REFERENCES "PaymentClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItemClaimAllocation" ADD CONSTRAINT "VariationItemClaimAllocation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidenceLink" ADD CONSTRAINT "ClaimEvidenceLink_paymentClaimId_fkey" FOREIGN KEY ("paymentClaimId") REFERENCES "PaymentClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItem" ADD CONSTRAINT "VariationItem_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItem" ADD CONSTRAINT "VariationItem_reactivatedByUserId_fkey" FOREIGN KEY ("reactivatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordLifecycleEvent" ADD CONSTRAINT "RecordLifecycleEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
