-- CreateEnum
CREATE TYPE "SafetyDocumentType" AS ENUM ('sssp', 'hazard_register', 'toolbox_talk', 'induction', 'incident_report', 'other');

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "qaRecordId" TEXT;

-- AlterTable
ALTER TABLE "SafetyDocument" ADD COLUMN     "type" "SafetyDocumentType" NOT NULL DEFAULT 'other';

-- CreateTable
CREATE TABLE "QARecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variationItemId" TEXT,
    "stage" TEXT NOT NULL,
    "notes" TEXT,
    "fileName" TEXT,
    "storageKey" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QARecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_qaRecordId_fkey" FOREIGN KEY ("qaRecordId") REFERENCES "QARecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARecord" ADD CONSTRAINT "QARecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARecord" ADD CONSTRAINT "QARecord_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

