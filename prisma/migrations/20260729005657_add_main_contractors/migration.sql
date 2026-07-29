-- CreateEnum
CREATE TYPE "ContractReviewComparisonType" AS ENUM ('baseline', 'prior_contract');

-- AlterEnum
ALTER TYPE "CorrespondenceSource" ADD VALUE 'response_letter_draft';

-- AlterTable
ALTER TABLE "ContractDeviation" ADD COLUMN     "isNewBaselineDrift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContractReview" ADD COLUMN     "comparedAgainstReviewId" TEXT,
ADD COLUMN     "comparedAgainstType" "ContractReviewComparisonType" NOT NULL DEFAULT 'baseline',
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newBaselineDriftCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "addressedToContactId" TEXT,
ADD COLUMN     "bodyText" TEXT,
ADD COLUMN     "outcomeContractDocumentId" TEXT,
ADD COLUMN     "outcomeNote" TEXT,
ADD COLUMN     "sourceContractReviewId" TEXT,
ADD COLUMN     "sourceDeviationIds" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "jobNumber" TEXT,
ADD COLUMN     "mainContractorId" TEXT;

-- CreateTable
CREATE TABLE "MainContractor" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MainContractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MainContractorContact" (
    "id" TEXT NOT NULL,
    "mainContractorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MainContractorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mainContractorContactId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContact_projectId_mainContractorContactId_key" ON "ProjectContact"("projectId", "mainContractorContactId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_mainContractorId_fkey" FOREIGN KEY ("mainContractorId") REFERENCES "MainContractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_comparedAgainstReviewId_fkey" FOREIGN KEY ("comparedAgainstReviewId") REFERENCES "ContractReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MainContractor" ADD CONSTRAINT "MainContractor_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MainContractorContact" ADD CONSTRAINT "MainContractorContact_mainContractorId_fkey" FOREIGN KEY ("mainContractorId") REFERENCES "MainContractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_mainContractorContactId_fkey" FOREIGN KEY ("mainContractorContactId") REFERENCES "MainContractorContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_addressedToContactId_fkey" FOREIGN KEY ("addressedToContactId") REFERENCES "MainContractorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_sourceContractReviewId_fkey" FOREIGN KEY ("sourceContractReviewId") REFERENCES "ContractReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_outcomeContractDocumentId_fkey" FOREIGN KEY ("outcomeContractDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
