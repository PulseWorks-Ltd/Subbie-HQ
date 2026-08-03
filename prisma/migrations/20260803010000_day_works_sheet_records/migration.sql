-- DropForeignKey
ALTER TABLE "DayWorksLabourEntry" DROP CONSTRAINT "DayWorksLabourEntry_dayWorksSheetId_fkey";

-- DropTable
DROP TABLE "DayWorksLabourEntry";

-- CreateTable
CREATE TABLE "DayWorksSheetRecord" (
    "id" TEXT NOT NULL,
    "dayWorksSheetId" TEXT NOT NULL,
    "sheetNumber" TEXT NOT NULL,
    "teamLeaderCount" INTEGER NOT NULL,
    "teamMemberCount" INTEGER NOT NULL,
    "totalHours" DECIMAL(6,2),
    "ratePerHour" DECIMAL(10,2),
    "date" TIMESTAMP(3),
    "startTime" TEXT,
    "finishTime" TEXT,
    "task" TEXT,
    "notes" TEXT,
    "weather" TEXT,
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayWorksSheetRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DayWorksSheetRecord" ADD CONSTRAINT "DayWorksSheetRecord_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
