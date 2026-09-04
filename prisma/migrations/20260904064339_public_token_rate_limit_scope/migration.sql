-- Adds a "scope" column to the (renamed, table-preserved) rate-limit table
-- so invite-link lookups and external-action lookups get independent
-- attempt budgets instead of sharing one counter. Existing rows all predate
-- this column and were all external-action attempts (this table's only
-- caller until now), so they backfill to "external-action" — the DEFAULT is
-- then dropped since the Prisma schema itself has no @default for this
-- column; every future INSERT is expected to always pass scope explicitly.
ALTER TABLE "ExternalActionLookupAttempt" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'external-action';
ALTER TABLE "ExternalActionLookupAttempt" ALTER COLUMN "scope" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ExternalActionLookupAttempt_scope_ipAddress_createdAt_idx" ON "ExternalActionLookupAttempt"("scope", "ipAddress", "createdAt");
