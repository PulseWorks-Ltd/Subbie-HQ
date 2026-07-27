-- AlterTable
ALTER TABLE "SiteInstruction" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "storageKey" TEXT;
