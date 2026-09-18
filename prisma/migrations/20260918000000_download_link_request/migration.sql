-- CreateTable
CREATE TABLE "DownloadLinkRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DownloadLinkRequest_userId_createdAt_idx" ON "DownloadLinkRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadLinkRequest_email_createdAt_idx" ON "DownloadLinkRequest"("email", "createdAt");
