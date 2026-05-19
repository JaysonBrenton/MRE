-- Per-user weather cache (host track override coordinates); separate from shared event venue weather_data.
CREATE TABLE "user_event_weather_data" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "weather_date" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "air_temperature" DOUBLE PRECISION NOT NULL,
    "humidity" INTEGER NOT NULL,
    "wind_speed" DOUBLE PRECISION NOT NULL,
    "wind_direction" INTEGER,
    "precipitation" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "track_temperature" DOUBLE PRECISION NOT NULL,
    "forecast" JSONB NOT NULL,
    "daily_temperature_summary" JSONB,
    "is_historical" BOOLEAN NOT NULL DEFAULT false,
    "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_event_weather_data_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_event_weather_data_user_id_event_id_weather_date_key" ON "user_event_weather_data"("user_id", "event_id", "weather_date");

CREATE INDEX "user_event_weather_data_user_id_event_id_idx" ON "user_event_weather_data"("user_id", "event_id");

CREATE INDEX "user_event_weather_data_expires_at_idx" ON "user_event_weather_data"("expires_at");

CREATE INDEX "user_event_weather_data_user_id_event_id_expires_at_idx" ON "user_event_weather_data"("user_id", "event_id", "expires_at");

ALTER TABLE "user_event_weather_data" ADD CONSTRAINT "user_event_weather_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_event_weather_data" ADD CONSTRAINT "user_event_weather_data_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
