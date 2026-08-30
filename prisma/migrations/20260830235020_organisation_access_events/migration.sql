-- CreateTable
CREATE TABLE "OrganisationAccessEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "fromStatus" "AccessStatus",
    "toStatus" "AccessStatus" NOT NULL,
    "planTier" "PlanTier",
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganisationAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganisationAccessEvent_organisationId_createdAt_idx" ON "OrganisationAccessEvent"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganisationAccessEvent" ADD CONSTRAINT "OrganisationAccessEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
