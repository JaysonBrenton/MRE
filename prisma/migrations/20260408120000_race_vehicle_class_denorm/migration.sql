-- Denormalized vehicle class + skill tier on races for Session Analysis (vehicle-first chips).

ALTER TABLE "races" ADD COLUMN "vehicle_type" TEXT;
ALTER TABLE "races" ADD COLUMN "skill_tier" TEXT;
ALTER TABLE "races" ADD COLUMN "vehicle_class_normalization_needs_review" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "races" ADD COLUMN "event_race_class_id" TEXT;

ALTER TABLE "races" ADD CONSTRAINT "races_event_race_class_id_fkey" FOREIGN KEY ("event_race_class_id") REFERENCES "event_race_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "races_event_id_vehicle_type_idx" ON "races"("event_id", "vehicle_type");
CREATE INDEX "races_event_race_class_id_idx" ON "races"("event_race_class_id");
