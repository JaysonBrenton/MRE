-- Add race_metadata (JSONB, nullable) to races for practice session end_time and practiceSessionStats.
ALTER TABLE "races" ADD COLUMN IF NOT EXISTS "race_metadata" JSONB;
