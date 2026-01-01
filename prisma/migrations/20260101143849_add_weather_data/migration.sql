-- CreateTable
CREATE TABLE "weather_data" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
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
    "is_historical" BOOLEAN NOT NULL DEFAULT false,
    "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weather_data_event_id_idx" ON "weather_data"("event_id");

-- CreateIndex
CREATE INDEX "weather_data_expires_at_idx" ON "weather_data"("expires_at");

-- CreateIndex
CREATE INDEX "weather_data_event_id_expires_at_idx" ON "weather_data"("event_id", "expires_at");

-- AddForeignKey
ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

