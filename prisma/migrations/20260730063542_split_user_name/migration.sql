-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;

-- Backfill: best-effort split of existing single `name` values into
-- firstName/lastName — first word vs. remainder (same rule as
-- lib/user-display.ts's splitFullName, used by the invite-accept flow for
-- consistency). A single-word name gets lastName = NULL rather than an
-- empty string.
UPDATE "User" SET
  "firstName" = split_part(trim("name"), ' ', 1),
  "lastName" = NULLIF(trim(substring(trim("name") from length(split_part(trim("name"), ' ', 1)) + 2)), '')
WHERE "name" IS NOT NULL AND trim("name") != '';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name";
