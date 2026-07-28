/*
  Warnings:

  - You are about to drop the `InsuranceRequirement` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "InsuranceCertificateType" AS ENUM ('public_liability', 'contract_works', 'professional_indemnity', 'vehicle', 'other');

-- CreateEnum
CREATE TYPE "InsuranceReminderStage" AS ENUM ('six_week', 'expired');

-- DropForeignKey
ALTER TABLE "InsuranceRequirement" DROP CONSTRAINT "InsuranceRequirement_projectId_fkey";

-- DropForeignKey
ALTER TABLE "InsuranceRequirement" DROP CONSTRAINT "InsuranceRequirement_sourceDocumentId_fkey";

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "sourceInsuranceCertificateId" TEXT;

-- DropTable
DROP TABLE "InsuranceRequirement";

-- DropEnum
DROP TYPE "InsuranceRequirementType";

-- CreateTable
CREATE TABLE "InsuranceCertificate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" "InsuranceCertificateType" NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT,
    "expiryAt" TIMESTAMP(3),
    "fileName" TEXT,
    "storageKey" TEXT,
    "lastReminderStage" "InsuranceReminderStage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceDistribution" (
    "id" TEXT NOT NULL,
    "insuranceCertificateId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "InsuranceDistribution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InsuranceCertificate" ADD CONSTRAINT "InsuranceCertificate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDistribution" ADD CONSTRAINT "InsuranceDistribution_insuranceCertificateId_fkey" FOREIGN KEY ("insuranceCertificateId") REFERENCES "InsuranceCertificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDistribution" ADD CONSTRAINT "InsuranceDistribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_sourceInsuranceCertificateId_fkey" FOREIGN KEY ("sourceInsuranceCertificateId") REFERENCES "InsuranceCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
