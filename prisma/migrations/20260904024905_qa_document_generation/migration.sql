-- CreateTable
CREATE TABLE "QaDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "docNumber" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "siteAddress" TEXT,
    "contractReference" TEXT,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaDocumentRecord" (
    "id" TEXT NOT NULL,
    "qaDocumentId" TEXT NOT NULL,
    "qaRecordId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "QaDocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QaDocument_projectId_docNumber_key" ON "QaDocument"("projectId", "docNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QaDocumentRecord_qaDocumentId_qaRecordId_key" ON "QaDocumentRecord"("qaDocumentId", "qaRecordId");

-- AddForeignKey
ALTER TABLE "QaDocument" ADD CONSTRAINT "QaDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaDocument" ADD CONSTRAINT "QaDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaDocumentRecord" ADD CONSTRAINT "QaDocumentRecord_qaDocumentId_fkey" FOREIGN KEY ("qaDocumentId") REFERENCES "QaDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaDocumentRecord" ADD CONSTRAINT "QaDocumentRecord_qaRecordId_fkey" FOREIGN KEY ("qaRecordId") REFERENCES "QARecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

