-- CreateTable
CREATE TABLE "DayWorksMaterial" (
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

    CONSTRAINT "DayWorksMaterial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DayWorksMaterial" ADD CONSTRAINT "DayWorksMaterial_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
