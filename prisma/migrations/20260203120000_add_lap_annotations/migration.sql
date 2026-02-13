-- CreateTable
CREATE TABLE "lap_annotations" (
    "id" TEXT NOT NULL,
    "race_result_id" TEXT NOT NULL,
    "lap_number" INTEGER NOT NULL,
    "invalid_reason" TEXT,
    "incident_type" TEXT,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lap_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lap_annotations_race_result_id_lap_number_key" ON "lap_annotations"("race_result_id", "lap_number");

-- CreateIndex
CREATE INDEX "lap_annotations_race_result_id_lap_number_idx" ON "lap_annotations"("race_result_id", "lap_number");

-- CreateIndex
CREATE INDEX "lap_annotations_race_result_id_idx" ON "lap_annotations"("race_result_id");

-- AddForeignKey
ALTER TABLE "lap_annotations" ADD CONSTRAINT "lap_annotations_race_result_id_fkey" FOREIGN KEY ("race_result_id") REFERENCES "race_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
