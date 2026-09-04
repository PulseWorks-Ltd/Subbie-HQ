-- AlterTable
ALTER TABLE "MainContractor" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "address" TEXT,
ADD COLUMN     "gstNumber" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "siteAddress" TEXT;

