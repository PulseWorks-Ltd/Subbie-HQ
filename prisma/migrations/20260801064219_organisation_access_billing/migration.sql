-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('pilot', 'trialing', 'active', 'past_due', 'canceled', 'none');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'professional', 'enterprise');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "accessStatus" "AccessStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "pilotAccessGrantedAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "planTier" "PlanTier",
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_stripeCustomerId_key" ON "Organisation"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_stripeSubscriptionId_key" ON "Organisation"("stripeSubscriptionId");

-- Grandfather every pre-existing organisation into pilot access — CRITICAL:
-- without this, the new access gate (app/(app)/layout.tsx) would lock out
-- every organisation that existed before this feature shipped, since the
-- column above defaults new rows to 'none'. Every row that was just
-- created before this ALTER TABLE ran got 'none' from that DEFAULT; this
-- flips all of them to 'pilot' in the same migration so nobody currently
-- using the app loses access.
UPDATE "Organisation" SET "accessStatus" = 'pilot', "pilotAccessGrantedAt" = CURRENT_TIMESTAMP WHERE "accessStatus" = 'none';
