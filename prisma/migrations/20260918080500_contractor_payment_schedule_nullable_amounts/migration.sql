-- AlterTable
ALTER TABLE "ContractorPaymentSchedule" ALTER COLUMN "claimedAmount" DROP NOT NULL,
ALTER COLUMN "certifiedAmount" DROP NOT NULL;
