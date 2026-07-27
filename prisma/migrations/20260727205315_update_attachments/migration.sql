-- CreateTable
CREATE TABLE "UpdateAttachment" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpdateAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UpdateAttachment" ADD CONSTRAINT "UpdateAttachment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
