-- Optional LiveRC links on telemetry sessions (event + race / practice row).

ALTER TABLE "telemetry_sessions" ADD COLUMN "liverc_event_id" TEXT;
ALTER TABLE "telemetry_sessions" ADD COLUMN "liverc_race_id" TEXT;

CREATE INDEX "telemetry_sessions_liverc_event_id_idx" ON "telemetry_sessions"("liverc_event_id");
CREATE INDEX "telemetry_sessions_liverc_race_id_idx" ON "telemetry_sessions"("liverc_race_id");

ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_liverc_event_id_fkey" FOREIGN KEY ("liverc_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_liverc_race_id_fkey" FOREIGN KEY ("liverc_race_id") REFERENCES "races"("id") ON DELETE SET NULL ON UPDATE CASCADE;
