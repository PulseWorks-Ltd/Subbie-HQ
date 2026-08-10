-- DayWorksSheetRecord (Labour) becomes independent of any specific Day
-- Works Sheet, matching the DayWorksMaterial/DayWorksPlant pattern
-- exactly — direct relation to VariationItem, with dayWorksSheetId kept
-- as a nullable historical/traceability reference. See
-- prisma/schema.prisma's comments on DayWorksSheetRecord/DayWorksSheet
-- for the reasoning.

-- AlterTable: add the new column nullable first so it can be backfilled,
-- then tightened to NOT NULL below once every row has a value.
ALTER TABLE "DayWorksSheetRecord" ADD COLUMN "variationItemId" TEXT;

-- Backfill from each row's current parent sheet — every existing row has
-- a dayWorksSheetId that resolves to a DayWorksSheet with a
-- variationItemId, so this is a complete, lossless backfill.
UPDATE "DayWorksSheetRecord" r
SET "variationItemId" = s."variationItemId"
FROM "DayWorksSheet" s
WHERE r."dayWorksSheetId" = s."id";

-- Now safe to require it going forward.
ALTER TABLE "DayWorksSheetRecord" ALTER COLUMN "variationItemId" SET NOT NULL;

-- dayWorksSheetId becomes a nullable historical/traceability reference
-- rather than the required parent.
ALTER TABLE "DayWorksSheetRecord" ALTER COLUMN "dayWorksSheetId" DROP NOT NULL;

-- Replace the old CASCADE-on-sheet-delete foreign key with SET NULL —
-- deleting a Day Works Sheet must no longer delete a labour record that's
-- independent of it; it should only clear its historical reference.
ALTER TABLE "DayWorksSheetRecord" DROP CONSTRAINT "DayWorksSheetRecord_dayWorksSheetId_fkey";
ALTER TABLE "DayWorksSheetRecord" ADD CONSTRAINT "DayWorksSheetRecord_dayWorksSheetId_fkey" FOREIGN KEY ("dayWorksSheetId") REFERENCES "DayWorksSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New direct relation to VariationItem — same ON DELETE RESTRICT ON
-- UPDATE CASCADE convention as DayWorksMaterial/DayWorksPlant's own
-- variationItemId FK.
ALTER TABLE "DayWorksSheetRecord" ADD CONSTRAINT "DayWorksSheetRecord_variationItemId_fkey" FOREIGN KEY ("variationItemId") REFERENCES "VariationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index to support "all labour records for this item" lookups, matching
-- DayWorksMaterial/DayWorksPlant's own variationItemId index.
CREATE INDEX "DayWorksSheetRecord_variationItemId_idx" ON "DayWorksSheetRecord"("variationItemId");
