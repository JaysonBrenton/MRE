-- Per-day weather cache: which UTC calendar day each row applies to
ALTER TABLE "weather_data" ADD COLUMN "weather_date" TIMESTAMP(3);

CREATE INDEX "weather_data_event_id_weather_date_idx" ON "weather_data"("event_id", "weather_date");

-- Backfill from event start date so existing rows match getWeatherForEvent lookups
UPDATE "weather_data" wd
SET "weather_date" = date_trunc('day', e."event_date")
FROM "events" e
WHERE wd."event_id" = e."id"
  AND wd."weather_date" IS NULL;
