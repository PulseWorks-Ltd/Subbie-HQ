-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'parsed', 'confirmed');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('draft', 'parsed', 'confirmed');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('draft', 'issued', 'responded');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'paid');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('upload', 'inbound_email', 'system_generated');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('new', 'reviewed', 'linked');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'low',
    "nextClaimDate" TIMESTAMP(3),
    "invoiceModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "sourceNotes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clauseRef" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'low',
    "status" "ItemStatus" NOT NULL DEFAULT 'parsed',
    "pageNumber" INTEGER,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'parsed',
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "ambiguityFlag" BOOLEAN NOT NULL DEFAULT false,
    "sourceDocumentId" TEXT,
    "sourceClauseId" TEXT,
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ItemStatus" NOT NULL DEFAULT 'parsed',
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeProgrammeLink" (
    "id" TEXT NOT NULL,
    "scopeItemId" TEXT NOT NULL,
    "programmeItemId" TEXT NOT NULL,

    CONSTRAINT "ScopeProgrammeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyWorkRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "completedValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyWorkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "VariationStatus" NOT NULL DEFAULT 'draft',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "claimNumber" INTEGER NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'draft',
    "claimedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statutoryWording" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceNumber" INTEGER NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceRef" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inboundEmailId" TEXT,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'new',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceScopeItem" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "scopeItemId" TEXT NOT NULL,

    CONSTRAINT "EvidenceScopeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceProgrammeItem" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "programmeItemId" TEXT NOT NULL,

    CONSTRAINT "EvidenceProgrammeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidencePaymentClaim" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "paymentClaimId" TEXT NOT NULL,

    CONSTRAINT "EvidencePaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OrganisationOwners" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeProgrammeLink_scopeItemId_programmeItemId_key" ON "ScopeProgrammeLink"("scopeItemId", "programmeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentClaim_projectId_claimNumber_key" ON "PaymentClaim"("projectId", "claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_projectId_invoiceNumber_key" ON "Invoice"("projectId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceScopeItem_evidenceId_scopeItemId_key" ON "EvidenceScopeItem"("evidenceId", "scopeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceProgrammeItem_evidenceId_programmeItemId_key" ON "EvidenceProgrammeItem"("evidenceId", "programmeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidencePaymentClaim_evidenceId_paymentClaimId_key" ON "EvidencePaymentClaim"("evidenceId", "paymentClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "_OrganisationOwners_AB_unique" ON "_OrganisationOwners"("A", "B");

-- CreateIndex
CREATE INDEX "_OrganisationOwners_B_index" ON "_OrganisationOwners"("B");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "Clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeItem" ADD CONSTRAINT "ProgrammeItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeItem" ADD CONSTRAINT "ProgrammeItem_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeProgrammeLink" ADD CONSTRAINT "ScopeProgrammeLink_scopeItemId_fkey" FOREIGN KEY ("scopeItemId") REFERENCES "ScopeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeProgrammeLink" ADD CONSTRAINT "ScopeProgrammeLink_programmeItemId_fkey" FOREIGN KEY ("programmeItemId") REFERENCES "ProgrammeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyWorkRecord" ADD CONSTRAINT "MonthlyWorkRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceScopeItem" ADD CONSTRAINT "EvidenceScopeItem_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceScopeItem" ADD CONSTRAINT "EvidenceScopeItem_scopeItemId_fkey" FOREIGN KEY ("scopeItemId") REFERENCES "ScopeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceProgrammeItem" ADD CONSTRAINT "EvidenceProgrammeItem_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceProgrammeItem" ADD CONSTRAINT "EvidenceProgrammeItem_programmeItemId_fkey" FOREIGN KEY ("programmeItemId") REFERENCES "ProgrammeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePaymentClaim" ADD CONSTRAINT "EvidencePaymentClaim_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePaymentClaim" ADD CONSTRAINT "EvidencePaymentClaim_paymentClaimId_fkey" FOREIGN KEY ("paymentClaimId") REFERENCES "PaymentClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganisationOwners" ADD CONSTRAINT "_OrganisationOwners_A_fkey" FOREIGN KEY ("A") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganisationOwners" ADD CONSTRAINT "_OrganisationOwners_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
