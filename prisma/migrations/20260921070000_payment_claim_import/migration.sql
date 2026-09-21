-- CreateEnum
CREATE TYPE "PaymentClaimSource" AS ENUM ('internal', 'imported_external');

-- CreateEnum
CREATE TYPE "PaymentClaimImportStatus" AS ENUM ('draft', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentClaimImportMatchStatus" AS ENUM ('matched', 'likely_match', 'new', 'conflict', 'unresolved', 'ignored');

-- CreateEnum
CREATE TYPE "PaymentClaimImportItemAction" AS ENUM ('pending', 'accept_match', 'create_new', 'ignore');

-- CreateEnum
CREATE TYPE "PaymentClaimImportVariationAction" AS ENUM ('pending', 'match_existing', 'create_new', 'update_existing', 'reactivate_and_update', 'ignore');

-- AlterEnum
ALTER TYPE "RecordLifecycleEntityType" ADD VALUE 'payment_claim_import';

-- AlterTable
ALTER TABLE "PaymentClaim" ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "source" "PaymentClaimSource" NOT NULL DEFAULT 'internal';

-- CreateTable
CREATE TABLE "PaymentClaimImport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "PaymentClaimImportStatus" NOT NULL DEFAULT 'draft',
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION,
    "aiNotes" TEXT,
    "extractedAt" TIMESTAMP(3),
    "externalClaimReference" TEXT,
    "claimDate" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "projectNameOnDocument" TEXT,
    "projectReferenceOnDocument" TEXT,
    "contractReferenceOnDocument" TEXT,
    "originalContractSum" DECIMAL(12,2),
    "approvedVariationsTotal" DECIMAL(12,2),
    "revisedContractSum" DECIMAL(12,2),
    "pendingVariationsTotal" DECIMAL(12,2),
    "grossClaimToDate" DECIMAL(12,2),
    "retentionPercentStated" DOUBLE PRECISION,
    "retentionToDateStated" DECIMAL(12,2),
    "netClaimToDate" DECIMAL(12,2),
    "previousClaimsTotal" DECIMAL(12,2),
    "currentClaimAmount" DECIMAL(12,2),
    "baselineDate" TIMESTAMP(3),
    "arithmeticWarning" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultingPaymentClaimId" TEXT,

    CONSTRAINT "PaymentClaimImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaimImportItem" (
    "id" TEXT NOT NULL,
    "paymentClaimImportId" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "contractValue" DECIMAL(12,2),
    "revisedValue" DECIMAL(12,2),
    "claimedPercentToDate" DOUBLE PRECISION,
    "claimedAmountToDate" DECIMAL(12,2),
    "currentPeriodAmount" DECIMAL(12,2),
    "previousClaimedAmount" DECIMAL(12,2),
    "matchStatus" "PaymentClaimImportMatchStatus" NOT NULL DEFAULT 'unresolved',
    "matchedContractItemId" TEXT,
    "matchReason" TEXT,
    "conflictNote" TEXT,
    "userAction" "PaymentClaimImportItemAction" NOT NULL DEFAULT 'pending',

    CONSTRAINT "PaymentClaimImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaimImportVariation" (
    "id" TEXT NOT NULL,
    "paymentClaimImportId" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "submittedValue" DECIMAL(12,2),
    "approvedValue" DECIMAL(12,2),
    "claimedPercentToDate" DOUBLE PRECISION,
    "claimedAmountToDate" DECIMAL(12,2),
    "currentPeriodAmount" DECIMAL(12,2),
    "approvalStatusRaw" TEXT,
    "matchStatus" "PaymentClaimImportMatchStatus" NOT NULL DEFAULT 'unresolved',
    "matchedVariationItemId" TEXT,
    "matchReason" TEXT,
    "conflictNote" TEXT,
    "existingRecordClosed" BOOLEAN NOT NULL DEFAULT false,
    "userAction" "PaymentClaimImportVariationAction" NOT NULL DEFAULT 'pending',

    CONSTRAINT "PaymentClaimImportVariation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentClaimImport_resultingPaymentClaimId_key" ON "PaymentClaimImport"("resultingPaymentClaimId");

-- CreateIndex
CREATE INDEX "PaymentClaimImport_projectId_idx" ON "PaymentClaimImport"("projectId");

-- CreateIndex
CREATE INDEX "PaymentClaimImport_projectId_documentHash_idx" ON "PaymentClaimImport"("projectId", "documentHash");

-- CreateIndex
CREATE INDEX "PaymentClaimImportItem_paymentClaimImportId_idx" ON "PaymentClaimImportItem"("paymentClaimImportId");

-- CreateIndex
CREATE INDEX "PaymentClaimImportVariation_paymentClaimImportId_idx" ON "PaymentClaimImportVariation"("paymentClaimImportId");

-- AddForeignKey
ALTER TABLE "PaymentClaimImport" ADD CONSTRAINT "PaymentClaimImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImport" ADD CONSTRAINT "PaymentClaimImport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImport" ADD CONSTRAINT "PaymentClaimImport_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImport" ADD CONSTRAINT "PaymentClaimImport_resultingPaymentClaimId_fkey" FOREIGN KEY ("resultingPaymentClaimId") REFERENCES "PaymentClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImportItem" ADD CONSTRAINT "PaymentClaimImportItem_paymentClaimImportId_fkey" FOREIGN KEY ("paymentClaimImportId") REFERENCES "PaymentClaimImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImportItem" ADD CONSTRAINT "PaymentClaimImportItem_matchedContractItemId_fkey" FOREIGN KEY ("matchedContractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImportVariation" ADD CONSTRAINT "PaymentClaimImportVariation_paymentClaimImportId_fkey" FOREIGN KEY ("paymentClaimImportId") REFERENCES "PaymentClaimImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaimImportVariation" ADD CONSTRAINT "PaymentClaimImportVariation_matchedVariationItemId_fkey" FOREIGN KEY ("matchedVariationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

