-- AlterTable
ALTER TABLE "QARecord" DROP COLUMN "fileName",
DROP COLUMN "storageKey";

-- AlterTable
ALTER TABLE "Update" ADD COLUMN     "qaRecordId" TEXT;

-- CreateTable
CREATE TABLE "QARecordAttachment" (
    "id" TEXT NOT NULL,
    "qaRecordId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT,
    "thumbnailStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QARecordAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Update" ADD CONSTRAINT "Update_qaRecordId_fkey" FOREIGN KEY ("qaRecordId") REFERENCES "QARecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARecordAttachment" ADD CONSTRAINT "QARecordAttachment_qaRecordId_fkey" FOREIGN KEY ("qaRecordId") REFERENCES "QARecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

