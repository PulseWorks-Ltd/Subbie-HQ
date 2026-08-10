-- Materials and Plant become independent of any specific Day Works Sheet
-- (Labour, Plant & Material AI Extraction) — direct relation to
-- VariationItem, with dayWorksSheetId kept as a nullable historical
-- reference. See prisma/schema.prisma's comments on DayWorksMaterial/
-- DayWorksPlant/DayWorksSheet for the reasoning.

-- AlterTable: add the new column nullable first so it can be backfilled,
-- then tightened to NOT NULL below once every row has a value.
ALTER TABLE "DayWorksMaterial" ADD COLUMN "variationItemId" TEXT;
ALTER TABLE "DayWorksPlant" ADD COLUMN "variationItemId" TEXT;

-- Backfill from each row's current parent sheet — every existing row has
-- a dayWorksSheetId that resolves to a DayWorksSheet with a
-- variationItemId, so this is a complete, lossless backfill.
UPDATE "DayWorksMaterial" m
SET "variationItemId" = s."variationItemId"
FROM "DayWorksSheet" s
WHERE m."dayWorksSheetId" = s."id";

UPDATE "DayWorksPlant" p
SET "variationItemId" = s."variationItemId"
FROM "DayWorksSheet" s
WHERE p."dayWorksSheetId" = s."id";

-- Now safe to require it going forward.
ALTER TABLE "DayWorksMaterial" ALTER COLUMN "variationItemId" SET NOT NULL;
ALTER TABLE "DayWorksPlant" ALTER COLUMN "variationItemId" SET NOT NULL;

-- dayWorksSheetId becomes a nullable historical reference rather than the
-- required parent.
ALTER TABLE "DayWorksMaterial" ALTER COLUMN "dayWorksSheetId" DROP NOT NULL;
ALTER TABLE "DayWorksPlant" ALTER COLUMN "dayWorksSheetId" DROP NOT NULL;

-- Replace the old CASCADE-on-sheet-delete foreign keys with SET NULL —
-- deleting a Day Works Sheet must no longer delete materials/plant that
-- are independent of it; it should only clear their historical reference.
ALTER TABLE "DayWorksMaterial" DROP CONSTRAINT "DayWorksMaterial_dayWorksSheetId_fkey";
ALTER TABLE "DayWorksMaterial" ADD CONSTRAINT "DayWorksMaterial_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DayWorksPlant" DROP CONSTRAINT "DayWorksPlant_dayWorksSheetId_fkey";
ALTER TABLE "DayWorksPlant" ADD CONSTRAINT "DayWorksPlant_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New direct relation to VariationItem — same ON DELETE RESTRICT ON
-- UPDATE CASCADE convention as DayWorksSheet's own variationItemId FK.
ALTER TABLE "DayWorksMaterial" ADD CONSTRAINT "DayWorksMaterial_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DayWorksPlant" ADD CONSTRAINT "DayWorksPlant_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index to support "all materials/plant for this item" lookups, matching
-- the existing pattern of indexing FK columns used in hot query paths.
CREATE INDEX "DayWorksMaterial_variationItemId_idx" ON "DayWorksMaterial"("variationItemId");
CREATE INDEX "DayWorksPlant_variationItemId_idx" ON "DayWorksPlant"("variationItemId");
