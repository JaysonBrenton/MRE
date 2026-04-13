-- Catalogue start/finish line on tracks; user SFL on telemetry sessions.

ALTER TABLE "tracks" ADD COLUMN "start_finish_line_geojson" JSONB;
ALTER TABLE "telemetry_sessions" ADD COLUMN "user_sfl_line_geojson" JSONB;
