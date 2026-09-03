-- CreateEnum
CREATE TYPE "ContractItemComponentKind" AS ENUM ('fixed', 'weekly_hire');

-- CreateEnum
CREATE TYPE "ContractItemProgressSource" AS ENUM ('manual', 'project_diary');

-- CreateTable
CREATE TABLE "ContractSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "sourceStorageKey" TEXT,
    "sourceContentType" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'confirmed',
    "defaultErectPercent" DOUBLE PRECISION,
    "defaultDismantlePercent" DOUBLE PRECISION,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "sectionLabel" TEXT,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItemComponent" (
    "id" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "kind" "ContractItemComponentKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "weeklyRate" DECIMAL(12,2),
    "quotedDurationWeeks" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractItemComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItemComponentPhase" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContractItemComponentPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItemProgressEntry" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT,
    "componentId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "source" "ContractItemProgressSource" NOT NULL DEFAULT 'manual',
    "projectDiaryUpdateId" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractItemProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractSchedule_projectId_key" ON "ContractSchedule"("projectId");

-- CreateIndex
CREATE INDEX "ContractItemProgressEntry_phaseId_effectiveDate_idx" ON "ContractItemProgressEntry"("phaseId", "effectiveDate");

-- CreateIndex
CREATE INDEX "ContractItemProgressEntry_componentId_effectiveDate_idx" ON "ContractItemProgressEntry"("componentId", "effectiveDate");

-- AddForeignKey
ALTER TABLE "ContractSchedule" ADD CONSTRAINT "ContractSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ContractSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemComponent" ADD CONSTRAINT "ContractItemComponent_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemComponentPhase" ADD CONSTRAINT "ContractItemComponentPhase_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ContractItemComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemProgressEntry" ADD CONSTRAINT "ContractItemProgressEntry_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ContractItemComponentPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemProgressEntry" ADD CONSTRAINT "ContractItemProgressEntry_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ContractItemComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemProgressEntry" ADD CONSTRAINT "ContractItemProgressEntry_projectDiaryUpdateId_fkey" FOREIGN KEY ("projectDiaryUpdateId") REFERENCES "Update"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemProgressEntry" ADD CONSTRAINT "ContractItemProgressEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

