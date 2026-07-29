-- AlterEnum
ALTER TYPE "CorrespondenceSource" ADD VALUE 'external_update';

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "sourceUpdateId" TEXT;

-- AlterTable
ALTER TABLE "Update" ADD COLUMN     "externalBody" TEXT,
ADD COLUMN     "externalSentAt" TIMESTAMP(3),
ADD COLUMN     "externalSubject" TEXT,
ADD COLUMN     "isExternal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UpdateRecipient" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "mainContractorContactId" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpdateRecipient_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UpdateRecipient" ADD CONSTRAINT "UpdateRecipient_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateRecipient" ADD CONSTRAINT "UpdateRecipient_mainContractorContactId_fkey" FOREIGN KEY ("mainContractorContactId") REFERENCES "MainContractorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_sourceUpdateId_fkey" FOREIGN KEY ("sourceUpdateId") REFERENCES "Update"("id") ON DELETE SET NULL ON UPDATE CASCADE;
