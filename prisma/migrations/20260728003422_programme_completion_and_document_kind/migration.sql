-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('contract', 'programme');

-- AlterTable
ALTER TABLE "ContractDocument" ADD COLUMN     "documentType" "DocumentKind" NOT NULL DEFAULT 'contract';

-- AlterTable
ALTER TABLE "ProgrammeItem" ADD COLUMN     "completedAt" TIMESTAMP(3);
