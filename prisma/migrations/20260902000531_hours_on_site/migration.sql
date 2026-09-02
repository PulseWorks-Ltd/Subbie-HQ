-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoursOnSiteSheet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variationItemId" TEXT,
    "comments" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "totalHours" DECIMAL(6,2),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoursOnSiteSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoursOnSiteWorker" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "HoursOnSiteWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Worker_organisationId_name_key" ON "Worker"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HoursOnSiteWorker_sheetId_workerId_key" ON "HoursOnSiteWorker"("sheetId", "workerId");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursOnSiteSheet" ADD CONSTRAINT "HoursOnSiteSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursOnSiteSheet" ADD CONSTRAINT "HoursOnSiteSheet_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursOnSiteSheet" ADD CONSTRAINT "HoursOnSiteSheet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursOnSiteWorker" ADD CONSTRAINT "HoursOnSiteWorker_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "HoursOnSiteSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursOnSiteWorker" ADD CONSTRAINT "HoursOnSiteWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
