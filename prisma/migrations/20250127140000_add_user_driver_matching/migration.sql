-- AddUserDriverMatching
-- Add user-driver matching tables and fields

-- Step 1: Add normalizedName and transponderNumber to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "normalized_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "transponder_number" TEXT;

-- Step 2: Create indexes on users table
CREATE INDEX IF NOT EXISTS "users_normalized_name_idx" ON "users"("normalized_name");
CREATE INDEX IF NOT EXISTS "users_transponder_number_idx" ON "users"("transponder_number");

-- Step 3: Populate normalized_name for existing users
-- Note: This will be done by application code, but we can set a placeholder
-- The application will compute normalized names on first access or via a script

-- Step 4: Create UserDriverLinkStatus enum
CREATE TYPE "UserDriverLinkStatus" AS ENUM ('suggested', 'confirmed', 'rejected', 'conflict');

-- Step 5: Create EventDriverLinkMatchType enum
CREATE TYPE "EventDriverLinkMatchType" AS ENUM ('transponder', 'exact', 'fuzzy');

-- Step 6: Create user_driver_links table
CREATE TABLE "user_driver_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "status" "UserDriverLinkStatus" NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "matched_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "matcher_id" TEXT NOT NULL,
    "matcher_version" TEXT NOT NULL,
    "conflict_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_driver_links_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create unique constraint on driver_id (one driver -> one user)
CREATE UNIQUE INDEX "user_driver_links_driver_id_key" ON "user_driver_links"("driver_id");

-- Step 8: Create unique constraint on (user_id, driver_id)
CREATE UNIQUE INDEX "user_driver_links_user_id_driver_id_key" ON "user_driver_links"("user_id", "driver_id");

-- Step 9: Create indexes on user_driver_links
CREATE INDEX "user_driver_links_user_id_idx" ON "user_driver_links"("user_id");
CREATE INDEX "user_driver_links_driver_id_idx" ON "user_driver_links"("driver_id");
CREATE INDEX "user_driver_links_status_idx" ON "user_driver_links"("status");

-- Step 10: Add foreign key constraints for user_driver_links
ALTER TABLE "user_driver_links" ADD CONSTRAINT "user_driver_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_driver_links" ADD CONSTRAINT "user_driver_links_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 11: Create event_driver_links table
CREATE TABLE "event_driver_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "user_driver_link_id" TEXT,
    "match_type" "EventDriverLinkMatchType" NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "transponder_number" TEXT,
    "matched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_driver_links_pkey" PRIMARY KEY ("id")
);

-- Step 12: Create unique constraint on (user_id, event_id, driver_id)
CREATE UNIQUE INDEX "event_driver_links_user_id_event_id_driver_id_key" ON "event_driver_links"("user_id", "event_id", "driver_id");

-- Step 13: Create indexes on event_driver_links
CREATE INDEX "event_driver_links_user_id_driver_id_transponder_number_idx" ON "event_driver_links"("user_id", "driver_id", "transponder_number");
CREATE INDEX "event_driver_links_event_id_driver_id_idx" ON "event_driver_links"("event_id", "driver_id");
CREATE INDEX "event_driver_links_user_driver_link_id_idx" ON "event_driver_links"("user_driver_link_id");

-- Step 14: Add foreign key constraints for event_driver_links
ALTER TABLE "event_driver_links" ADD CONSTRAINT "event_driver_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_driver_links" ADD CONSTRAINT "event_driver_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_driver_links" ADD CONSTRAINT "event_driver_links_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_driver_links" ADD CONSTRAINT "event_driver_links_user_driver_link_id_fkey" FOREIGN KEY ("user_driver_link_id") REFERENCES "user_driver_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 15: Add index on drivers.normalized_name if it doesn't exist
CREATE INDEX IF NOT EXISTS "drivers_normalized_name_idx" ON "drivers"("normalized_name");

