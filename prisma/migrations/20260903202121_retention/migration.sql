-- CreateTable
CREATE TABLE "Retention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "practicalCompletionDateOverride" TIMESTAMP(3),
    "tranche1ExpectedDate" TIMESTAMP(3),
    "tranche1Percent" DOUBLE PRECISION,
    "tranche1ReleasedAmount" DECIMAL(12,2),
    "tranche1ReleasedAt" TIMESTAMP(3),
    "tranche1LastReminderStage" "ReminderStage",
    "tranche2ExpectedDate" TIMESTAMP(3),
    "tranche2Percent" DOUBLE PRECISION,
    "tranche2ReleasedAmount" DECIMAL(12,2),
    "tranche2ReleasedAt" TIMESTAMP(3),
    "tranche2LastReminderStage" "ReminderStage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Retention_projectId_key" ON "Retention"("projectId");

-- AddForeignKey
ALTER TABLE "Retention" ADD CONSTRAINT "Retention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

