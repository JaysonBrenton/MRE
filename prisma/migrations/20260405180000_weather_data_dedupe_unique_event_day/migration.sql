-- Remove duplicate weather cache rows (keep newest cached_at per event + day)
DELETE FROM "weather_data" wd
WHERE wd."id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "event_id", "weather_date"
        ORDER BY "cached_at" DESC NULLS LAST, "id" DESC
      ) AS "_rn"
    FROM "weather_data"
    WHERE "weather_date" IS NOT NULL
  ) "_dedupe"
  WHERE "_dedupe"."_rn" > 1
);

DELETE FROM "weather_data" wd
WHERE wd."id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "event_id"
        ORDER BY "cached_at" DESC NULLS LAST, "id" DESC
      ) AS "_rn"
    FROM "weather_data"
    WHERE "weather_date" IS NULL
  ) "_dedupe"
  WHERE "_dedupe"."_rn" > 1
);

-- One cache row per event per calendar day (PostgreSQL treats each NULL as distinct; app always sets weather_date now)
DROP INDEX IF EXISTS "weather_data_event_id_weather_date_idx";

CREATE UNIQUE INDEX "weather_data_event_id_weather_date_key" ON "weather_data"("event_id", "weather_date");
