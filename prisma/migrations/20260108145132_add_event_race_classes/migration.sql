-- AlterTable
ALTER TABLE "event_entries" ADD COLUMN     "event_race_class_id" TEXT;

-- CreateTable
CREATE TABLE "event_race_classes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "vehicle_type" TEXT,
    "vehicle_type_needs_review" BOOLEAN NOT NULL DEFAULT true,
    "vehicle_type_reviewed_at" TIMESTAMP(3),
    "vehicle_type_reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_race_classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_race_classes_event_id_idx" ON "event_race_classes"("event_id");

-- CreateIndex
CREATE INDEX "event_race_classes_event_id_class_name_idx" ON "event_race_classes"("event_id", "class_name");

-- CreateIndex
CREATE UNIQUE INDEX "event_race_classes_event_id_class_name_key" ON "event_race_classes"("event_id", "class_name");

-- CreateIndex
CREATE INDEX "event_entries_event_race_class_id_idx" ON "event_entries"("event_race_class_id");

-- AddForeignKey
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_event_race_class_id_fkey" FOREIGN KEY ("event_race_class_id") REFERENCES "event_race_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_race_classes" ADD CONSTRAINT "event_race_classes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

