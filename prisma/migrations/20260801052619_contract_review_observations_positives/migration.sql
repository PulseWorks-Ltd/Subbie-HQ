-- AlterTable
ALTER TABLE "ContractReview" ADD COLUMN     "keyObservations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "positiveFindings" JSONB;
