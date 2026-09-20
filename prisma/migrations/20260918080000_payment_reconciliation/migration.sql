-- CreateEnum
CREATE TYPE "ContractorPaymentScheduleSource" AS ENUM ('manual', 'document_upload');

-- CreateEnum
CREATE TYPE "ContractorPaymentScheduleStatus" AS ENUM ('draft', 'confirmed');

-- AlterEnum
ALTER TYPE "ClaimEvidenceType" ADD VALUE 'contractor_payment_schedule';

-- CreateTable
CREATE TABLE "ContractorPaymentSchedule" (
    "id" TEXT NOT NULL,
    "paymentClaimId" TEXT NOT NULL,
    "source" "ContractorPaymentScheduleSource" NOT NULL,
    "status" "ContractorPaymentScheduleStatus" NOT NULL DEFAULT 'draft',
    "claimedAmount" DECIMAL(12,2) NOT NULL,
    "certifiedAmount" DECIMAL(12,2) NOT NULL,
    "declinedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "statedRetentionAmount" DECIMAL(12,2),
    "receivedAmount" DECIMAL(12,2),
    "paymentDueDate" TIMESTAMP(3),
    "paymentReceivedDate" TIMESTAMP(3),
    "fileName" TEXT,
    "storageKey" TEXT,
    "contentType" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiNotes" TEXT,
    "extractedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorPaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationDeclineLine" (
    "id" TEXT NOT NULL,
    "contractorPaymentScheduleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "variationItemId" TEXT,

    CONSTRAINT "PaymentReconciliationDeclineLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationAdjustment" (
    "id" TEXT NOT NULL,
    "contractorPaymentScheduleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorPaymentSchedule_paymentClaimId_idx" ON "ContractorPaymentSchedule"("paymentClaimId");

-- CreateIndex
CREATE INDEX "PaymentReconciliationDeclineLine_contractorPaymentScheduleI_idx" ON "PaymentReconciliationDeclineLine"("contractorPaymentScheduleId");

-- CreateIndex
CREATE INDEX "PaymentReconciliationAdjustment_contractorPaymentScheduleId_idx" ON "PaymentReconciliationAdjustment"("contractorPaymentScheduleId");

-- AddForeignKey
ALTER TABLE "ContractorPaymentSchedule" ADD CONSTRAINT "ContractorPaymentSchedule_paymentClaimId_fkey" FOREIGN KEY ("paymentClaimId") REFERENCES "PaymentClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPaymentSchedule" ADD CONSTRAINT "ContractorPaymentSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPaymentSchedule" ADD CONSTRAINT "ContractorPaymentSchedule_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationDeclineLine" ADD CONSTRAINT "PaymentReconciliationDeclineLine_contractorPaymentSchedule_fkey" FOREIGN KEY ("contractorPaymentScheduleId") REFERENCES "ContractorPaymentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationDeclineLine" ADD CONSTRAINT "PaymentReconciliationDeclineLine_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationAdjustment" ADD CONSTRAINT "PaymentReconciliationAdjustment_contractorPaymentScheduleI_fkey" FOREIGN KEY ("contractorPaymentScheduleId") REFERENCES "ContractorPaymentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationAdjustment" ADD CONSTRAINT "PaymentReconciliationAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

