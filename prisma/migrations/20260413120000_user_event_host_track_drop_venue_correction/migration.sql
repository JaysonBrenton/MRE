-- Drop deprecated venue correction tables (replaced by per-user host track).
DROP TABLE IF EXISTS "event_venue_correction_requests";
DROP TABLE IF EXISTS "event_venue_corrections";
DROP TYPE IF EXISTS "EventVenueCorrectionRequestStatus";

-- Per-user host track for event analysis (catalogue track pick).
CREATE TABLE "user_event_host_tracks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "host_track_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_event_host_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_event_host_tracks_user_id_event_id_key" ON "user_event_host_tracks"("user_id", "event_id");
CREATE INDEX "user_event_host_tracks_user_id_idx" ON "user_event_host_tracks"("user_id");
CREATE INDEX "user_event_host_tracks_event_id_idx" ON "user_event_host_tracks"("event_id");

ALTER TABLE "user_event_host_tracks" ADD CONSTRAINT "user_event_host_tracks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_event_host_tracks" ADD CONSTRAINT "user_event_host_tracks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_event_host_tracks" ADD CONSTRAINT "user_event_host_tracks_host_track_id_fkey" FOREIGN KEY ("host_track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
