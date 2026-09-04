-- CreateEnum
CREATE TYPE "RetentionReleaseTrigger" AS ENUM ('completion_of_subcontract_works', 'practical_completion_subcontractor', 'final_payment_claim', 'final_account', 'head_contract_event', 'other_event', 'not_stated');

-- CreateEnum
CREATE TYPE "RetentionTimingUnit" AS ENUM ('working_days', 'calendar_days', 'weeks', 'months');

-- AlterEnum
ALTER TYPE "RecordLifecycleEntityType" ADD VALUE 'retention';

-- AlterEnum
ALTER TYPE "RecordLifecycleEventType" ADD VALUE 'milestone';

-- AlterTable
ALTER TABLE "ContractTerms" ADD COLUMN     "finalReleasePercent" DOUBLE PRECISION,
ADD COLUMN     "finalReleaseTimingDays" INTEGER,
ADD COLUMN     "finalReleaseTimingDescription" TEXT,
ADD COLUMN     "finalReleaseTimingUnit" "RetentionTimingUnit",
ADD COLUMN     "finalReleaseTrigger" "RetentionReleaseTrigger",
ADD COLUMN     "initialReleasePercent" DOUBLE PRECISION,
ADD COLUMN     "initialReleaseTimingDays" INTEGER,
ADD COLUMN     "initialReleaseTimingDescription" TEXT,
ADD COLUMN     "initialReleaseTimingUnit" "RetentionTimingUnit",
ADD COLUMN     "initialReleaseTrigger" "RetentionReleaseTrigger",
ADD COLUMN     "retentionApplies" BOOLEAN,
ADD COLUMN     "retentionCapAmount" DECIMAL(12,2),
ADD COLUMN     "retentionClauseReference" TEXT,
ADD COLUMN     "retentionRequiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionReviewNotes" TEXT,
ADD COLUMN     "suggestedFinalReleasePercent" DOUBLE PRECISION,
ADD COLUMN     "suggestedFinalReleaseTimingDays" INTEGER,
ADD COLUMN     "suggestedFinalReleaseTimingDescription" TEXT,
ADD COLUMN     "suggestedFinalReleaseTimingUnit" "RetentionTimingUnit",
ADD COLUMN     "suggestedFinalReleaseTrigger" "RetentionReleaseTrigger",
ADD COLUMN     "suggestedInitialReleasePercent" DOUBLE PRECISION,
ADD COLUMN     "suggestedInitialReleaseTimingDays" INTEGER,
ADD COLUMN     "suggestedInitialReleaseTimingDescription" TEXT,
ADD COLUMN     "suggestedInitialReleaseTimingUnit" "RetentionTimingUnit",
ADD COLUMN     "suggestedInitialReleaseTrigger" "RetentionReleaseTrigger",
ADD COLUMN     "suggestedRetentionApplies" BOOLEAN,
ADD COLUMN     "suggestedRetentionCapAmount" DECIMAL(12,2),
ADD COLUMN     "suggestedRetentionClauseReference" TEXT;

-- AlterTable
ALTER TABLE "Retention" DROP COLUMN "practicalCompletionDateOverride",
ADD COLUMN     "completionOfWorksConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "completionOfWorksConfirmedByUserId" TEXT,
ADD COLUMN     "completionOfWorksDateOverride" TIMESTAMP(3),
ADD COLUMN     "completionOfWorksNote" TEXT;

-- CreateTable
CREATE TABLE "RetentionEvidenceLink" (
    "id" TEXT NOT NULL,
    "retentionId" TEXT NOT NULL,
    "evidenceType" "ClaimEvidenceType" NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetentionEvidenceLink_retentionId_evidenceType_evidenceId_key" ON "RetentionEvidenceLink"("retentionId", "evidenceType", "evidenceId");

-- AddForeignKey
ALTER TABLE "Retention" ADD CONSTRAINT "Retention_completionOfWorksConfirmedByUserId_fkey" FOREIGN KEY ("completionOfWorksConfirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionEvidenceLink" ADD CONSTRAINT "RetentionEvidenceLink_retentionId_fkey" FOREIGN KEY ("retentionId") REFERENCES "Retention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

