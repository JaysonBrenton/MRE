-- CreateTable
CREATE TABLE "transponder_overrides" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "effective_from_race_id" TEXT,
    "transponder_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "transponder_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transponder_overrides_event_id_driver_id_effective_from_race_id_key" ON "transponder_overrides"("event_id", "driver_id", "effective_from_race_id");

-- CreateIndex
CREATE INDEX "transponder_overrides_event_id_driver_id_idx" ON "transponder_overrides"("event_id", "driver_id");

-- CreateIndex
CREATE INDEX "transponder_overrides_effective_from_race_id_idx" ON "transponder_overrides"("effective_from_race_id");

-- AddForeignKey
ALTER TABLE "transponder_overrides" ADD CONSTRAINT "transponder_overrides_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transponder_overrides" ADD CONSTRAINT "transponder_overrides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transponder_overrides" ADD CONSTRAINT "transponder_overrides_effective_from_race_id_fkey" FOREIGN KEY ("effective_from_race_id") REFERENCES "races"("id") ON DELETE SET NULL ON UPDATE CASCADE;

