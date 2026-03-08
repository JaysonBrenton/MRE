-- Add event date range and total race laps to events
ALTER TABLE "events" ADD COLUMN "event_date_end" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "total_race_laps" INTEGER;

-- EventQualPoints: Qual Points (best X of Y) standings from view_points page
CREATE TABLE IF NOT EXISTS "event_qual_points" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_points_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rounds_completed" INTEGER,
    "total_rounds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_qual_points_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_qual_points_event_id_source_points_id_key" ON "event_qual_points"("event_id", "source_points_id");
CREATE INDEX IF NOT EXISTS "event_qual_points_event_id_idx" ON "event_qual_points"("event_id");

-- EventQualPointsEntry: Per-class, per-driver qual points result
CREATE TABLE IF NOT EXISTS "event_qual_points_entries" (
    "id" TEXT NOT NULL,
    "event_qual_points_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "round_breakdown_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_qual_points_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_qual_points_entries_qual_points_driver_class_key" ON "event_qual_points_entries"("event_qual_points_id", "driver_id", "class_name");
CREATE INDEX IF NOT EXISTS "event_qual_points_entries_event_qual_points_id_idx" ON "event_qual_points_entries"("event_qual_points_id");
CREATE INDEX IF NOT EXISTS "event_qual_points_entries_driver_id_idx" ON "event_qual_points_entries"("driver_id");

-- EventRoundRanking: Practice/Qualifier Round Rankings from view_round_ranking page
CREATE TABLE IF NOT EXISTS "event_round_rankings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_round_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_round_rankings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_round_rankings_event_id_source_round_id_key" ON "event_round_rankings"("event_id", "source_round_id");
CREATE INDEX IF NOT EXISTS "event_round_rankings_event_id_idx" ON "event_round_rankings"("event_id");

-- EventRoundRankingEntry: Per-class, per-driver round ranking result
CREATE TABLE IF NOT EXISTS "event_round_ranking_entries" (
    "id" TEXT NOT NULL,
    "event_round_ranking_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "laps" INTEGER,
    "total_time_seconds" DOUBLE PRECISION,
    "best_lap_seconds" DOUBLE PRECISION,
    "ranking_value_raw" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_round_ranking_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_round_ranking_entries_ranking_driver_class_key" ON "event_round_ranking_entries"("event_round_ranking_id", "driver_id", "class_name");
CREATE INDEX IF NOT EXISTS "event_round_ranking_entries_event_round_ranking_id_idx" ON "event_round_ranking_entries"("event_round_ranking_id");
CREATE INDEX IF NOT EXISTS "event_round_ranking_entries_driver_id_idx" ON "event_round_ranking_entries"("driver_id");

-- Foreign keys
ALTER TABLE "event_qual_points" ADD CONSTRAINT "event_qual_points_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_qual_points_entries" ADD CONSTRAINT "event_qual_points_entries_event_qual_points_id_fkey" FOREIGN KEY ("event_qual_points_id") REFERENCES "event_qual_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_qual_points_entries" ADD CONSTRAINT "event_qual_points_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_round_rankings" ADD CONSTRAINT "event_round_rankings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_round_ranking_entries" ADD CONSTRAINT "event_round_ranking_entries_event_round_ranking_id_fkey" FOREIGN KEY ("event_round_ranking_id") REFERENCES "event_round_rankings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_round_ranking_entries" ADD CONSTRAINT "event_round_ranking_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
