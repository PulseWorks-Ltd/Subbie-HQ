-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "organisationId" TEXT,
    "userId" TEXT,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "costUsd" DECIMAL(10,6),
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "contextRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelPricing" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputPricePerMillion" DECIMAL(10,4) NOT NULL,
    "outputPricePerMillion" DECIMAL(10,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModelPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_feature_createdAt_idx" ON "AiUsageLog"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_organisationId_createdAt_idx" ON "AiUsageLog"("organisationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiModelPricing_model_key" ON "AiModelPricing"("model");
