-- Event Search performance indexes (omnibox ILIKE, browse, track-scoped, practice days).
-- pg_trgm powers case-insensitive substring search on names; partial indexes match
-- fixed filters used in src/core/events/repo.ts (exclude practice rows, laps_full).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Omnibox: suggestEventsByText (event_name ILIKE '%q%')
CREATE INDEX IF NOT EXISTS "events_event_name_trgm_idx"
  ON "events" USING gin ("event_name" gin_trgm_ops);

-- Omnibox: suggestTracksByText (track_name / city / slug ILIKE '%q%')
CREATE INDEX IF NOT EXISTS "tracks_track_name_trgm_idx"
  ON "tracks" USING gin ("track_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "tracks_city_trgm_idx"
  ON "tracks" USING gin ("city" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "tracks_source_track_slug_trgm_idx"
  ON "tracks" USING gin ("source_track_slug" gin_trgm_ops);

-- Global browse + track search: regular (non-practice) events, newest first
CREATE INDEX IF NOT EXISTS "events_regular_by_date_idx"
  ON "events" ("event_date" DESC, "id" DESC)
  WHERE "source_event_id" NOT LIKE '%-practice-%';

-- Database-only browse (Search LiveRC off): laps_full regular events
CREATE INDEX IF NOT EXISTS "events_regular_laps_full_by_date_idx"
  ON "events" ("event_date" DESC, "id" DESC)
  WHERE "source_event_id" NOT LIKE '%-practice-%'
    AND "ingest_depth" = 'laps_full';

-- Track-scoped search with LiveRC off (laps_full at track)
CREATE INDEX IF NOT EXISTS "events_track_laps_full_by_date_idx"
  ON "events" ("track_id", "event_date" DESC)
  WHERE "ingest_depth" = 'laps_full'
    AND "source_event_id" NOT LIKE '%-practice-%';

-- Practice day search (source_event_id contains '-practice-')
CREATE INDEX IF NOT EXISTS "events_practice_by_track_date_idx"
  ON "events" ("track_id", "event_date" DESC)
  WHERE "source_event_id" LIKE '%-practice-%';

-- Omnibox event suggest: ingested events only (ingest_depth != none), excluding practice
CREATE INDEX IF NOT EXISTS "events_suggest_ingested_by_date_idx"
  ON "events" ("event_date" DESC)
  WHERE "source_event_id" NOT LIKE '%-practice-%'
    AND "ingest_depth" <> 'none';
