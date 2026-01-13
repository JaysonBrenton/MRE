-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('race', 'practice', 'qualifying');

-- AlterTable
ALTER TABLE "races" ADD COLUMN "session_type" "SessionType";

-- CreateIndex
CREATE INDEX "races_session_type_idx" ON "races"("session_type");

-- CreateIndex
CREATE INDEX "races_event_id_session_type_idx" ON "races"("event_id", "session_type");

-- Set default value for existing rows (all existing races default to 'race')
UPDATE "races" SET "session_type" = 'race' WHERE "session_type" IS NULL;
