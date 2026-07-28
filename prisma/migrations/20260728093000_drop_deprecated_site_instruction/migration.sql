-- DropForeignKey
ALTER TABLE "SiteInstruction" DROP CONSTRAINT "SiteInstruction_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Update" DROP CONSTRAINT "Update_siteInstructionId_fkey";

-- AlterTable
ALTER TABLE "Update" DROP COLUMN "siteInstructionId";

-- DropTable
DROP TABLE "SiteInstruction";

-- DropEnum
DROP TYPE "SiteInstructionStatus";
