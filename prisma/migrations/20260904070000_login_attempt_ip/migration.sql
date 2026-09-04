-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");
