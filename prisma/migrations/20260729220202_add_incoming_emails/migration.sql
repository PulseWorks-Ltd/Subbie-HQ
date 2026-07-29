/*
  Warnings:

  - The `status` column on the `InboundEmail` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `organisationId` to the `InboundEmail` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('pending_review', 'filed', 'dismissed');

-- DropForeignKey
ALTER TABLE "InboundEmail" DROP CONSTRAINT "InboundEmail_projectId_fkey";

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "organisationId" TEXT NOT NULL,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "suggestedProjectConfidence" DOUBLE PRECISION,
ADD COLUMN     "suggestedProjectId" TEXT,
ADD COLUMN     "suggestedType" TEXT,
ADD COLUMN     "suggestedVariationItemId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "InboundEmailStatus" NOT NULL DEFAULT 'pending_review';

-- DropEnum
DROP TYPE "EmailStatus";

-- CreateTable
CREATE TABLE "InboundEmailAttachment" (
    "id" TEXT NOT NULL,
    "inboundEmailId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmailAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_suggestedProjectId_fkey" FOREIGN KEY ("suggestedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_suggestedVariationItemId_fkey" FOREIGN KEY ("suggestedVariationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmailAttachment" ADD CONSTRAINT "InboundEmailAttachment_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
