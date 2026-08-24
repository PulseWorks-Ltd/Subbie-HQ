-- CreateEnum
CREATE TYPE "UpdateCategory" AS ENUM ('general', 'progress', 'health_safety', 'delay', 'site_instruction', 'variation', 'day_works', 'delivery', 'defect', 'other');

-- AlterTable
ALTER TABLE "Update" ADD COLUMN     "category" "UpdateCategory";

