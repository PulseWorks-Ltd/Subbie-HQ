-- CreateTable
CREATE TABLE "RegisterAttempt" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegisterAttempt_ipAddress_createdAt_idx" ON "RegisterAttempt"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "RegisterAttempt_email_createdAt_idx" ON "RegisterAttempt"("email", "createdAt");
