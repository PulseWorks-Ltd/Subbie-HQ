-- CreateTable
CREATE TABLE "InsuranceCertificateCover" (
    "id" TEXT NOT NULL,
    "insuranceCertificateId" TEXT NOT NULL,
    "coverType" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceCertificateCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractRequiredCover" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "coverType" TEXT NOT NULL,
    "requiredValue" DECIMAL(65,30) NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceContractReviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractRequiredCover_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InsuranceCertificateCover" ADD CONSTRAINT "InsuranceCertificateCover_insuranceCertificateId_fkey" FOREIGN KEY ("insuranceCertificateId") REFERENCES "InsuranceCertificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRequiredCover" ADD CONSTRAINT "ContractRequiredCover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRequiredCover" ADD CONSTRAINT "ContractRequiredCover_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
