-- AlterTable
ALTER TABLE "VariationPackage" ADD COLUMN     "includedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: every package generated before this feature existed
-- unconditionally included every category, so an empty array here would
-- misleadingly read as "nothing was included" — set the full category
-- list on existing rows only.
UPDATE "VariationPackage"
SET "includedCategories" = ARRAY['quote', 'day_works_sheets', 'si_source_document', 'correspondence', 'linked_updates', 'photos']
WHERE "includedCategories" = ARRAY[]::TEXT[];
