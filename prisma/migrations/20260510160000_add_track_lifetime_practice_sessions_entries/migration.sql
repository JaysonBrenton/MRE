-- AlterTable
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "total_practice_sessions" INTEGER DEFAULT 0;
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "total_entries" INTEGER DEFAULT 0;
