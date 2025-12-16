-- CreateEnum
CREATE TYPE "IngestDepth" AS ENUM ('none', 'summary_only', 'laps_full');

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_track_slug" TEXT NOT NULL,
    "track_name" TEXT NOT NULL,
    "track_url" TEXT NOT NULL,
    "events_url" TEXT NOT NULL,
    "liverc_track_last_updated" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_followed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "event_entries" INTEGER NOT NULL,
    "event_drivers" INTEGER NOT NULL,
    "event_url" TEXT NOT NULL,
    "ingest_depth" "IngestDepth" NOT NULL DEFAULT 'none',
    "last_ingested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "races" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_race_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "race_label" TEXT NOT NULL,
    "race_order" INTEGER,
    "race_url" TEXT NOT NULL,
    "start_time" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_drivers" (
    "id" TEXT NOT NULL,
    "race_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_driver_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_results" (
    "id" TEXT NOT NULL,
    "race_id" TEXT NOT NULL,
    "race_driver_id" TEXT NOT NULL,
    "position_final" INTEGER NOT NULL,
    "laps_completed" INTEGER NOT NULL,
    "total_time_raw" TEXT,
    "total_time_seconds" DOUBLE PRECISION,
    "fast_lap_time" DOUBLE PRECISION,
    "avg_lap_time" DOUBLE PRECISION,
    "consistency" DOUBLE PRECISION,
    "raw_fields_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laps" (
    "id" TEXT NOT NULL,
    "race_result_id" TEXT NOT NULL,
    "lap_number" INTEGER NOT NULL,
    "position_on_lap" INTEGER NOT NULL,
    "lap_time_raw" TEXT NOT NULL,
    "lap_time_seconds" DOUBLE PRECISION NOT NULL,
    "pace_string" TEXT,
    "elapsed_race_time" DOUBLE PRECISION NOT NULL,
    "segments_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracks_source_source_track_slug_idx" ON "tracks"("source", "source_track_slug");

-- CreateIndex
CREATE INDEX "tracks_is_active_is_followed_idx" ON "tracks"("is_active", "is_followed");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_source_source_track_slug_key" ON "tracks"("source", "source_track_slug");

-- CreateIndex
CREATE INDEX "events_source_source_event_id_idx" ON "events"("source", "source_event_id");

-- CreateIndex
CREATE INDEX "events_track_id_idx" ON "events"("track_id");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date");

-- CreateIndex
CREATE INDEX "events_ingest_depth_idx" ON "events"("ingest_depth");

-- CreateIndex
CREATE UNIQUE INDEX "events_source_source_event_id_key" ON "events"("source", "source_event_id");

-- CreateIndex
CREATE INDEX "races_event_id_source_race_id_idx" ON "races"("event_id", "source_race_id");

-- CreateIndex
CREATE INDEX "races_event_id_idx" ON "races"("event_id");

-- CreateIndex
CREATE INDEX "races_race_order_idx" ON "races"("race_order");

-- CreateIndex
CREATE UNIQUE INDEX "races_event_id_source_race_id_key" ON "races"("event_id", "source_race_id");

-- CreateIndex
CREATE INDEX "race_drivers_race_id_source_driver_id_idx" ON "race_drivers"("race_id", "source_driver_id");

-- CreateIndex
CREATE INDEX "race_drivers_race_id_idx" ON "race_drivers"("race_id");

-- CreateIndex
CREATE UNIQUE INDEX "race_drivers_race_id_source_driver_id_key" ON "race_drivers"("race_id", "source_driver_id");

-- CreateIndex
CREATE INDEX "race_results_race_id_race_driver_id_idx" ON "race_results"("race_id", "race_driver_id");

-- CreateIndex
CREATE INDEX "race_results_race_id_idx" ON "race_results"("race_id");

-- CreateIndex
CREATE INDEX "race_results_race_driver_id_idx" ON "race_results"("race_driver_id");

-- CreateIndex
CREATE INDEX "race_results_position_final_idx" ON "race_results"("position_final");

-- CreateIndex
CREATE UNIQUE INDEX "race_results_race_id_race_driver_id_key" ON "race_results"("race_id", "race_driver_id");

-- CreateIndex
CREATE INDEX "laps_race_result_id_lap_number_idx" ON "laps"("race_result_id", "lap_number");

-- CreateIndex
CREATE INDEX "laps_race_result_id_idx" ON "laps"("race_result_id");

-- CreateIndex
CREATE INDEX "laps_lap_number_idx" ON "laps"("lap_number");

-- CreateIndex
CREATE UNIQUE INDEX "laps_race_result_id_lap_number_key" ON "laps"("race_result_id", "lap_number");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "races" ADD CONSTRAINT "races_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_drivers" ADD CONSTRAINT "race_drivers_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_driver_id_fkey" FOREIGN KEY ("race_driver_id") REFERENCES "race_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laps" ADD CONSTRAINT "laps_race_result_id_fkey" FOREIGN KEY ("race_result_id") REFERENCES "race_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
