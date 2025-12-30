-- Add composite index on (track_id, event_date) for improved event search performance
CREATE INDEX IF NOT EXISTS "events_track_id_event_date_idx" ON "events"("track_id", "event_date");

