-- CreateDriverTable
-- Add normalized Driver table and update RaceDriver to reference it
-- This migration normalizes driver identity across all races/events

-- Step 1: Create drivers table
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_driver_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create unique constraint on (source, source_driver_id)
CREATE UNIQUE INDEX "drivers_source_source_driver_id_key" ON "drivers"("source", "source_driver_id");

-- Step 3: Create indexes
CREATE INDEX "drivers_source_source_driver_id_idx" ON "drivers"("source", "source_driver_id");
CREATE INDEX "drivers_display_name_idx" ON "drivers"("display_name");

-- Step 4: Populate drivers table from existing race_drivers
-- Group by (source, source_driver_id) and use the most recent display_name
INSERT INTO "drivers" ("id", "source", "source_driver_id", "display_name", "created_at", "updated_at")
SELECT 
    gen_random_uuid()::text as id,
    rd."source",
    rd."source_driver_id",
    MAX(rd."display_name") as display_name, -- Use MAX to get a consistent name (could be improved)
    MIN(rd."created_at") as created_at,
    MAX(rd."updated_at") as updated_at
FROM "race_drivers" rd
GROUP BY rd."source", rd."source_driver_id";

-- Step 5: Add driver_id column to race_drivers (nullable initially)
ALTER TABLE "race_drivers" ADD COLUMN "driver_id" TEXT;

-- Step 6: Populate driver_id by joining on (source, source_driver_id)
UPDATE "race_drivers" rd
SET "driver_id" = d."id"
FROM "drivers" d
WHERE rd."source" = d."source" 
  AND rd."source_driver_id" = d."source_driver_id";

-- Step 7: Make driver_id NOT NULL
ALTER TABLE "race_drivers" ALTER COLUMN "driver_id" SET NOT NULL;

-- Step 8: Add foreign key constraint
ALTER TABLE "race_drivers" ADD CONSTRAINT "race_drivers_driver_id_fkey" 
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 9: Create index on driver_id
CREATE INDEX "race_drivers_driver_id_idx" ON "race_drivers"("driver_id");

