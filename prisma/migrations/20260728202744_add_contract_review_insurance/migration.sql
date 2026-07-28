-- CreateEnum
CREATE TYPE "ContractReviewStatus" AS ENUM ('running', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "DeviationClassification" AS ENUM ('matches_standard', 'minor_deviation', 'major_deviation', 'missing_from_subcontract', 'additional_in_subcontract');

-- CreateEnum
CREATE TYPE "InsuranceRequirementType" AS ENUM ('contract_works', 'plant_and_equipment', 'public_liability', 'motor_vehicle_liability', 'professional_indemnity', 'other');

-- CreateTable
CREATE TABLE "ContractReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "standardFormVersion" TEXT NOT NULL,
    "status" "ContractReviewStatus" NOT NULL DEFAULT 'running',
    "executiveSummary" TEXT,
    "overallRiskLevel" "RiskLevel",
    "majorDeviationCount" INTEGER NOT NULL DEFAULT 0,
    "minorDeviationCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "rawModelOutputs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ContractReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDeviation" (
    "id" TEXT NOT NULL,
    "contractReviewId" TEXT NOT NULL,
    "topicBucket" TEXT NOT NULL,
    "baselineClauseRef" TEXT,
    "baselineClauseTitle" TEXT,
    "subcontractClauseRef" TEXT,
    "subcontractExcerpt" TEXT,
    "classification" "DeviationClassification" NOT NULL,
    "impact" "RiskLevel" NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "recommendation" TEXT,
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDeviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTerms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceContractReviewId" TEXT,
    "paymentClaimMethod" TEXT,
    "paymentClaimDay" INTEGER,
    "variationNoticePeriodDays" INTEGER,
    "variationNoticeMethod" TEXT,
    "retentionPercent" DOUBLE PRECISION,
    "defectsLiabilityPeriodDays" INTEGER,
    "disputeNoticeMethod" TEXT,
    "generalNoticeMethod" TEXT,
    "suggestedPaymentClaimMethod" TEXT,
    "suggestedPaymentClaimDay" INTEGER,
    "suggestedVariationNoticePeriodDays" INTEGER,
    "suggestedVariationNoticeMethod" TEXT,
    "suggestedRetentionPercent" DOUBLE PRECISION,
    "suggestedDefectsLiabilityPeriodDays" INTEGER,
    "suggestedDisputeNoticeMethod" TEXT,
    "suggestedGeneralNoticeMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTerms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "InsuranceRequirementType" NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minimumAmount" DECIMAL(65,30),
    "status" "ItemStatus" NOT NULL DEFAULT 'parsed',
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "sourceDocumentId" TEXT,
    "sourceContractReviewId" TEXT,
    "sourcePage" INTEGER,
    "certificateFileName" TEXT,
    "certificateStorageKey" TEXT,
    "certificateExpiresAt" TIMESTAMP(3),
    "lastReminderStage" "ReminderStage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractTerms_projectId_key" ON "ContractTerms"("projectId");

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDeviation" ADD CONSTRAINT "ContractDeviation_contractReviewId_fkey" FOREIGN KEY ("contractReviewId") REFERENCES "ContractReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTerms" ADD CONSTRAINT "ContractTerms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTerms" ADD CONSTRAINT "ContractTerms_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceRequirement" ADD CONSTRAINT "InsuranceRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceRequirement" ADD CONSTRAINT "InsuranceRequirement_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
