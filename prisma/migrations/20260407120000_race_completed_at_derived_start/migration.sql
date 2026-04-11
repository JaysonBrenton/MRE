-- AlterTable
ALTER TABLE "races" ADD COLUMN "completed_at" TIMESTAMP(3);

-- Historical rows: start_time held LiveRC "Time Completed" for non-practice races
UPDATE "races"
SET "completed_at" = "start_time"
WHERE "completed_at" IS NULL
  AND "start_time" IS NOT NULL
  AND ("session_type" IS NULL OR "session_type"::text <> 'practiceday');

-- Session start = Time Completed − Length (timed), when both known
UPDATE "races"
SET "start_time" = "completed_at" - ("duration_seconds" * interval '1 second')
WHERE "duration_seconds" IS NOT NULL
  AND "completed_at" IS NOT NULL
  AND ("session_type" IS NULL OR "session_type"::text <> 'practiceday');
