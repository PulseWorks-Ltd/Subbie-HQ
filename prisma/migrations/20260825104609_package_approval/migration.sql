-- AlterTable
ALTER TABLE "ExternalAction" ADD COLUMN     "variationPackageId" TEXT;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_variationPackageId_fkey" FOREIGN KEY ("variationPackageId") REFERENCES "VariationPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

