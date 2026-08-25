-- CreateEnum
CREATE TYPE "VariationAutomationMode" AS ENUM ('manual', 'automatic_with_approval', 'fully_automatic');

-- CreateEnum
CREATE TYPE "VariationRecipientRole" AS ENUM ('to', 'cc');

-- CreateEnum
CREATE TYPE "VariationScheduleRunStatus" AS ENUM ('pending_warning', 'warned', 'sent', 'cancelled', 'skipped_no_items');

-- CreateEnum
CREATE TYPE "VariationScheduleType" AS ENUM ('fixed_date', 'working_days_before_month_end');

-- AlterTable
ALTER TABLE "ContractTerms" ADD COLUMN     "suggestedVariationScheduleType" "VariationScheduleType",
ADD COLUMN     "suggestedVariationScheduleValue" INTEGER,
ADD COLUMN     "variationScheduleType" "VariationScheduleType",
ADD COLUMN     "variationScheduleValue" INTEGER;

-- AlterTable
ALTER TABLE "ExternalAction" ADD COLUMN     "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "variationAutomationMode" "VariationAutomationMode" NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "VariationScheduleRecipient" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "VariationRecipientRole" NOT NULL DEFAULT 'to',
    "mainContractorContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationScheduleRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationScheduleRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cycleMonth" TEXT NOT NULL,
    "scheduledSendAt" TIMESTAMP(3) NOT NULL,
    "warningAt" TIMESTAMP(3),
    "status" "VariationScheduleRunStatus" NOT NULL DEFAULT 'pending_warning',
    "warnedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariationScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VariationScheduleRun_projectId_cycleMonth_key" ON "VariationScheduleRun"("projectId", "cycleMonth");

-- AddForeignKey
ALTER TABLE "VariationScheduleRecipient" ADD CONSTRAINT "VariationScheduleRecipient_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationScheduleRecipient" ADD CONSTRAINT "VariationScheduleRecipient_mainContractorContactId_fkey" FOREIGN KEY ("mainContractorContactId") REFERENCES "MainContractorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationScheduleRun" ADD CONSTRAINT "VariationScheduleRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationScheduleRun" ADD CONSTRAINT "VariationScheduleRun_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
