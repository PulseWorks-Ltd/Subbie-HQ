-- CreateEnum
CREATE TYPE "DelayEventStatus" AS ENUM ('open', 'notice_sent', 'awarded', 'rejected', 'closed');

-- AlterTable
ALTER TABLE "ContractTerms" ADD COLUMN     "delayNoticeMethod" TEXT,
ADD COLUMN     "delayNoticePeriodDays" INTEGER,
ADD COLUMN     "suggestedDelayNoticeMethod" TEXT,
ADD COLUMN     "suggestedDelayNoticePeriodDays" INTEGER;

-- AlterTable
ALTER TABLE "ExternalAction" ADD COLUMN     "delayEventId" TEXT;

-- CreateTable
CREATE TABLE "DelayEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variationItemId" TEXT,
    "cause" TEXT NOT NULL,
    "clauseReference" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "daysClaimed" INTEGER,
    "daysAwarded" INTEGER,
    "noticeDeadline" TIMESTAMP(3),
    "noticeSentAt" TIMESTAMP(3),
    "lastReminderStage" "ReminderStage",
    "status" "DelayEventStatus" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelayEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DelayEvent" ADD CONSTRAINT "DelayEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayEvent" ADD CONSTRAINT "DelayEvent_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayEvent" ADD CONSTRAINT "DelayEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAction" ADD CONSTRAINT "ExternalAction_delayEventId_fkey" FOREIGN KEY ("delayEventId") REFERENCES "DelayEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

