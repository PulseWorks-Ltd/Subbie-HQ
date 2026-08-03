-- AlterTable
ALTER TABLE "VariationItem" ADD COLUMN "instructedByName" TEXT;

-- CreateTable
CREATE TABLE "DayWorksPlant" (
    "id" TEXT NOT NULL,
    "dayWorksSheetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "photoFileName" TEXT,
    "photoStorageKey" TEXT,
    "photoContentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayWorksPlant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationPackage" (
    "id" TEXT NOT NULL,
    "variationItemId" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "labourTotal" DECIMAL(12,2) NOT NULL,
    "materialsTotal" DECIMAL(12,2) NOT NULL,
    "materialsMarkupTotal" DECIMAL(12,2) NOT NULL,
    "plantTotal" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "photoCount" INTEGER NOT NULL,
    "correspondenceCount" INTEGER NOT NULL,
    "dayWorksSheetCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationPackage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DayWorksPlant" ADD CONSTRAINT "DayWorksPlant_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationPackage" ADD CONSTRAINT "VariationPackage_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationPackage" ADD CONSTRAINT "VariationPackage_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
