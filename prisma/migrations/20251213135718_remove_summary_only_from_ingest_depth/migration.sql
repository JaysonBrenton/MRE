-- AlterEnum
-- Remove summary_only from IngestDepth enum using safe migration pattern
-- This migration uses the standard "new type, cast, drop old, rename" approach
-- to safely remove an enum value from PostgreSQL.

-- Step 1: Check for existing summary_only values (should be none in V1)
-- If any exist, they will fail during the cast step below
-- To check before running: SELECT DISTINCT ingest_depth FROM events;

-- Step 2: Create new enum type without summary_only
CREATE TYPE "IngestDepth_new" AS ENUM ('none', 'laps_full');

-- Step 3: Drop default constraint first
ALTER TABLE "events" 
  ALTER COLUMN "ingest_depth" DROP DEFAULT;

-- Step 4: Alter column to use new type with cast
ALTER TABLE "events" 
  ALTER COLUMN "ingest_depth" TYPE "IngestDepth_new" 
  USING "ingest_depth"::text::"IngestDepth_new";

-- Step 5: Restore default
ALTER TABLE "events" 
  ALTER COLUMN "ingest_depth" SET DEFAULT 'none'::"IngestDepth_new";

-- Step 6: Drop old enum type
DROP TYPE "IngestDepth";

-- Step 7: Rename new enum to old name
ALTER TYPE "IngestDepth_new" RENAME TO "IngestDepth";

