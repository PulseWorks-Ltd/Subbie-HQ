-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('idle', 'processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "ContractDocument" ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'idle';
