-- CreateTable
CREATE TABLE "multi_main_results" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_multi_main_id" TEXT NOT NULL,
    "class_label" TEXT NOT NULL,
    "tie_breaker" TEXT,
    "completed_mains" INTEGER NOT NULL,
    "total_mains" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multi_main_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multi_main_result_entries" (
    "id" TEXT NOT NULL,
    "multi_main_result_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "seeded_position" INTEGER,
    "driver_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "main_breakdown_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multi_main_result_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "multi_main_results_event_id_source_multi_main_id_key" ON "multi_main_results"("event_id", "source_multi_main_id");

-- CreateIndex
CREATE INDEX "multi_main_results_event_id_idx" ON "multi_main_results"("event_id");

-- CreateIndex
CREATE INDEX "multi_main_results_event_id_source_multi_main_id_idx" ON "multi_main_results"("event_id", "source_multi_main_id");

-- CreateIndex
CREATE UNIQUE INDEX "multi_main_result_entries_multi_main_result_id_driver_id_key" ON "multi_main_result_entries"("multi_main_result_id", "driver_id");

-- CreateIndex
CREATE INDEX "multi_main_result_entries_multi_main_result_id_idx" ON "multi_main_result_entries"("multi_main_result_id");

-- CreateIndex
CREATE INDEX "multi_main_result_entries_driver_id_idx" ON "multi_main_result_entries"("driver_id");

-- AddForeignKey
ALTER TABLE "multi_main_results" ADD CONSTRAINT "multi_main_results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multi_main_result_entries" ADD CONSTRAINT "multi_main_result_entries_multi_main_result_id_fkey" FOREIGN KEY ("multi_main_result_id") REFERENCES "multi_main_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multi_main_result_entries" ADD CONSTRAINT "multi_main_result_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
