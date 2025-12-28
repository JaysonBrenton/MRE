-- AddPersonas
-- Add persona system with Persona model and User persona assignment

-- Step 1: Create PersonaType enum
CREATE TYPE "PersonaType" AS ENUM ('driver', 'admin', 'team_manager', 'race_engineer');

-- Step 2: Create personas table
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "type" "PersonaType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "permissions" JSONB,
    "preferences" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create unique constraint on type (one persona per type)
CREATE UNIQUE INDEX "personas_type_key" ON "personas"("type");

-- Step 4: Insert default personas
INSERT INTO "personas" ("id", "type", "name", "description", "created_at", "updated_at")
VALUES
    (gen_random_uuid()::text, 'driver', 'Driver', 'Individual RC racer who participates in events and tracks their performance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'admin', 'Administrator', 'System administrator with elevated privileges for managing the application', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'team_manager', 'Team Manager', 'Manager of a team of one or more drivers, coordinates team activities', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'race_engineer', 'Race Engineer', 'AI-backed assistant providing setup and tuning guidance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 5: Add persona_id column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "persona_id" TEXT;

-- Step 6: Add is_team_manager column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_team_manager" BOOLEAN NOT NULL DEFAULT false;

-- Step 7: Create index on persona_id
CREATE INDEX IF NOT EXISTS "users_persona_id_idx" ON "users"("persona_id");

-- Step 8: Create index on (is_team_manager, "teamName") for team queries
-- Note: teamName is camelCase as created in the initial migration
CREATE INDEX IF NOT EXISTS "users_is_team_manager_team_name_idx" ON "users"("is_team_manager", "teamName");

-- Step 9: Add foreign key constraint for persona_id
ALTER TABLE "users" ADD CONSTRAINT "users_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 10: Auto-assign Driver persona to existing users without a persona
UPDATE "users"
SET "persona_id" = (SELECT "id" FROM "personas" WHERE "type" = 'driver' LIMIT 1)
WHERE "persona_id" IS NULL;

-- Step 11: Auto-assign Admin persona to existing admin users
UPDATE "users"
SET "persona_id" = (SELECT "id" FROM "personas" WHERE "type" = 'admin' LIMIT 1)
WHERE "isAdmin" = true AND "persona_id" IS NULL;

