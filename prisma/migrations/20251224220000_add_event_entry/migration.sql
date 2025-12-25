-- CreateTable
CREATE TABLE "event_entries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "transponder_number" TEXT,
    "car_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_entries_event_id_driver_id_class_name_key" ON "event_entries"("event_id", "driver_id", "class_name");

-- CreateIndex
CREATE INDEX "event_entries_event_id_idx" ON "event_entries"("event_id");

-- CreateIndex
CREATE INDEX "event_entries_driver_id_idx" ON "event_entries"("driver_id");

-- CreateIndex
CREATE INDEX "event_entries_class_name_idx" ON "event_entries"("class_name");

-- AddForeignKey
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

