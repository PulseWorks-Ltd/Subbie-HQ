-- CreateEnum
CREATE TYPE "DayWorksRateType" AS ENUM ('normal', 'night', 'sunday_holiday');

-- AlterTable
ALTER TABLE "DayWorksSheet" ADD COLUMN "contentType" TEXT;

-- CreateTable
CREATE TABLE "DayWorksLabourEntry" (
    "id" TEXT NOT NULL,
    "dayWorksSheetId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "hours" DECIMAL(5,2) NOT NULL,
    "rateType" "DayWorksRateType" NOT NULL,
    "taskDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayWorksLabourEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DayWorksLabourEntry" ADD CONSTRAINT "DayWorksLabourEntry_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
