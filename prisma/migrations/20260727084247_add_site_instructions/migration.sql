-- CreateEnum
CREATE TYPE "SiteInstructionStatus" AS ENUM ('open', 'complete');

-- AlterTable
ALTER TABLE "Update" ADD COLUMN     "siteInstructionId" TEXT;

-- CreateTable
CREATE TABLE "SiteInstruction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SiteInstructionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteInstruction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Update" ADD CONSTRAINT "Update_siteInstructionId_fkey" FOREIGN KEY ("siteInstructionId") REFERENCES "SiteInstruction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteInstruction" ADD CONSTRAINT "SiteInstruction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
