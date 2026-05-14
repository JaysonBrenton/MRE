-- CreateTable
CREATE TABLE "pit_stop_events" (
    "id" TEXT NOT NULL,
    "race_result_id" TEXT NOT NULL,
    "lap_number" INTEGER NOT NULL,
    "pit_time_estimate_seconds" DOUBLE PRECISION NOT NULL,
    "pit_time_earliest_seconds" DOUBLE PRECISION,
    "pit_time_latest_seconds" DOUBLE PRECISION,
    "pit_time_loss_seconds" DOUBLE PRECISION,
    "baseline_seconds" DOUBLE PRECISION,
    "detection_confidence" DOUBLE PRECISION,
    "detection_version" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pit_stop_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_pit_strategies" (
    "id" TEXT NOT NULL,
    "race_result_id" TEXT NOT NULL,
    "strategy_label" TEXT NOT NULL,
    "strategy_confidence" DOUBLE PRECISION,
    "pit_count_detected" INTEGER NOT NULL,
    "median_interval_seconds" DOUBLE PRECISION,
    "intervals_json" JSONB,
    "detection_version" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_pit_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pit_stop_events_race_result_id_lap_number_key" ON "pit_stop_events"("race_result_id", "lap_number");

-- CreateIndex
CREATE INDEX "pit_stop_events_race_result_id_pit_time_estimate_seconds_idx" ON "pit_stop_events"("race_result_id", "pit_time_estimate_seconds");

-- CreateIndex
CREATE INDEX "pit_stop_events_race_result_id_idx" ON "pit_stop_events"("race_result_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_pit_strategies_race_result_id_key" ON "driver_pit_strategies"("race_result_id");

-- CreateIndex
CREATE INDEX "driver_pit_strategies_strategy_label_idx" ON "driver_pit_strategies"("strategy_label");

-- AddForeignKey
ALTER TABLE "pit_stop_events" ADD CONSTRAINT "pit_stop_events_race_result_id_fkey" FOREIGN KEY ("race_result_id") REFERENCES "race_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_pit_strategies" ADD CONSTRAINT "driver_pit_strategies_race_result_id_fkey" FOREIGN KEY ("race_result_id") REFERENCES "race_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
