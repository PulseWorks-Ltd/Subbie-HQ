-- AlterTable
ALTER TABLE "ContractTerms" ADD COLUMN     "finalReleaseAnchorEndOfMonth" BOOLEAN,
ADD COLUMN     "initialReleaseAnchorEndOfMonth" BOOLEAN,
ADD COLUMN     "suggestedFinalReleaseAnchorEndOfMonth" BOOLEAN,
ADD COLUMN     "suggestedInitialReleaseAnchorEndOfMonth" BOOLEAN;

