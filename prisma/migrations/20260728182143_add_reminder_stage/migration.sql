-- CreateEnum
CREATE TYPE "ReminderStage" AS ENUM ('three_day', 'one_day', 'due_today', 'overdue');

-- AlterTable
ALTER TABLE "SafetyDocument" ADD COLUMN     "lastReminderStage" "ReminderStage";

-- AlterTable
ALTER TABLE "VariationItem" ADD COLUMN     "lastReminderStage" "ReminderStage";
