-- AlterEnum
ALTER TYPE "UpdateCategory" ADD VALUE 'contract';

-- AlterTable
ALTER TABLE "Update" ADD COLUMN     "freeTextSiteInstructionReference" TEXT;

-- CreateTable
CREATE TABLE "ContractItemDiaryLink" (
    "id" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractItemDiaryLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractItemDiaryLink_contractItemId_updateId_key" ON "ContractItemDiaryLink"("contractItemId", "updateId");

-- AddForeignKey
ALTER TABLE "ContractItemDiaryLink" ADD CONSTRAINT "ContractItemDiaryLink_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemDiaryLink" ADD CONSTRAINT "ContractItemDiaryLink_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

