-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('payment_cash_flow', 'variations', 'notices_time_bars', 'programme_delay', 'liability_indemnity', 'insurance', 'administration_documentation', 'health_safety', 'intellectual_property', 'final_account', 'termination', 'other');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('critical', 'important', 'informational');

-- AlterTable
ALTER TABLE "ContractDeviation" ADD COLUMN     "category" "FindingCategory",
ADD COLUMN     "severity" "FindingSeverity";
