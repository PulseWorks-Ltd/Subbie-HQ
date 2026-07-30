-- AlterTable
ALTER TABLE "VariationItem" ADD COLUMN     "variationCreatedAt" TIMESTAMP(3),
ADD COLUMN     "variationValue" DECIMAL(65,30);

-- Backfill: every existing type='variation' row already inherently carries
-- a Variation identity (it IS one) — mark it as such retroactively using its
-- own creation date, so "since when" stays meaningful for pre-existing rows.
UPDATE "VariationItem" SET "variationCreatedAt" = "createdAt" WHERE "type" = 'variation';
