-- CreateTable
CREATE TABLE "event_overall_rankings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_overall_ranking_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_overall_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_overall_ranking_entries" (
    "id" TEXT NOT NULL,
    "event_overall_ranking_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "race_label" TEXT,
    "result_raw" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_overall_ranking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_overall_rankings_event_id_source_overall_ranking_id_key"
ON "event_overall_rankings"("event_id", "source_overall_ranking_id");

-- CreateIndex
CREATE INDEX "event_overall_rankings_event_id_idx" ON "event_overall_rankings"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_overall_ranking_entries_overall_driver_class_key"
ON "event_overall_ranking_entries"("event_overall_ranking_id", "driver_id", "class_name");

-- CreateIndex
CREATE INDEX "event_overall_ranking_entries_event_overall_ranking_id_idx"
ON "event_overall_ranking_entries"("event_overall_ranking_id");

-- CreateIndex
CREATE INDEX "event_overall_ranking_entries_driver_id_idx"
ON "event_overall_ranking_entries"("driver_id");

-- AddForeignKey
ALTER TABLE "event_overall_rankings"
ADD CONSTRAINT "event_overall_rankings_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_overall_ranking_entries"
ADD CONSTRAINT "event_overall_ranking_entries_event_overall_ranking_id_fkey"
FOREIGN KEY ("event_overall_ranking_id") REFERENCES "event_overall_rankings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_overall_ranking_entries"
ADD CONSTRAINT "event_overall_ranking_entries_driver_id_fkey"
FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
