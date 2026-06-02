# Parser Implementation Status

## Overview

The LiveRC ingestion pipeline is **100% complete**. All parsers have been
implemented with real CSS selectors based on HTML samples. All infrastructure,
sync operations, CLI commands, API endpoints, and parsers are fully functional.

## Completed Components

### Infrastructure (100%)

- ✅ Database models (SQLAlchemy)
- ✅ Repository layer with idempotent upserts
- ✅ Error handling system
- ✅ State machine
- ✅ Normalizer
- ✅ Validator
- ✅ Logging infrastructure
- ✅ URL utility module

### Connector Layer (100%)

- ✅ HTTPX client with retry logic
- ✅ Playwright client for browser automation
- ✅ Connector orchestration
- ✅ `list_tracks()` method
- ✅ `list_events_for_track()` method
- ✅ URL building utilities
- ✅ All parsers fully implemented with CSS selectors

### API Endpoints (FastAPI, prefix `/api/v1`)

Defined in `ingestion/api/routes.py` (source of truth):

- ✅ `POST /tracks/sync`, `GET /tracks/sync/{job_id}` (async track sync job)
- ✅ `POST /events/sync` (sync events for a track)
- ✅ `POST /events/discover` (connector-only event discovery)
- ✅ `POST /events/{event_id}/ingest`, `POST /events/ingest` (by source id +
  track) — return **202 + job_id** when `INGESTION_USE_QUEUE=true` (default)
- ✅ `GET /ingestion/jobs/{job_id}` (queued job status)
- ✅ `GET /ingestion/status/{event_id}` (event ingestion status)
- ✅ `POST /events/entry-list` (parsed entry list)
- ✅ `POST /practice-days/discover`, `GET /practice-days/search`,
  `POST /practice-days/ingest`
- ✅ `GET /health`

### CLI Commands (Click, `python -m ingestion.cli`)

Under `ingest liverc`:

- ✅ `list-tracks` - List all tracks
- ✅ `refresh-tracks` - Sync track catalogue (`--metadata/--no-metadata`)
- ✅ `backfill-track-countries` - Backfill `country` from city/state
  (`--dry-run`)
- ✅ `list-events` - List events for track
- ✅ `refresh-events` - Sync events for track (`--depth`, `--ingest-new-only`,
  `--ingest-all`)
- ✅ `refresh-followed-events` - Refresh all followed tracks
- ✅ `refresh-recent-events` - Discover + full-ingest recent events
  (auto-ingest)
- ✅ `ingest-event` - Ingest event data (`--depth`, `--force`)
- ✅ `reingest-section-headers` - Repair null `section_header` events
- ✅ `status` - Show ingestion statistics
- ✅ `verify-integrity` - Check data integrity

Top-level (not under `liverc`):

- ✅ `auto-confirm-links` - Confirm user–driver links
- ✅ `drivers deduplicate` - Merge duplicate drivers (`--execute`, `--source`)

### Minor Completions (100%)

- ✅ Total time raw extraction
- ✅ Enhanced status command statistics

## Parser Implementation Status

All parsers are **100% complete** with real CSS selectors and full
functionality:

### TrackListParser (`ingestion/connectors/liverc/parsers/track_list_parser.py`)

- **Status**: ✅ **100% Complete**
- **CSS Selectors**: `table.track_list tbody tr.clickable-row`, `td a[href]`,
  `td a strong`, `td:first-child small small`
- **Features**:
  - Extracts track slug from URL (`//{slug}.liverc.com/`)
  - Extracts track name from `<strong>` tag
  - Extracts last updated timestamp
  - Builds track URL and events URL
  - Handles malformed URLs gracefully

### EventListParser (`ingestion/connectors/liverc/parsers/event_list_parser.py`)

- **Status**: ✅ **100% Complete**
- **CSS Selectors**: `table#events tbody tr`, `td:first-child a[href]`,
  `td:nth-child(2) span.hidden`, `td:nth-child(3)`, `td:nth-child(4)`
- **Features**:
  - Extracts event ID from URL query parameter
  - Parses event date from hidden span (ISO format)
  - Extracts entries and drivers counts
  - Builds full event URLs
  - Skips header rows automatically

### EventMetadataParser (`ingestion/connectors/liverc/parsers/event_metadata_parser.py`)

- **Status**: ✅ **100% Complete**
- **CSS Selectors**: `h3.page-header`, `h5.page-header`,
  `table.table-sm tbody tr`
- **Features**:
  - Extracts event name from page header (removes icon text)
  - Parses event date (date only, no time)
  - Extracts entries and drivers from Event Stats table
  - Handles entries/drivers in same cell with `<br />` separator

### RaceListParser (`ingestion/connectors/liverc/parsers/race_list_parser.py`)

- **Status**: ✅ **100% Complete**
- **CSS Selectors**: `table.entry_list_data tbody tr`,
  `td a[href*="view_race_result"]`, `td:nth-child(2)`
- **Features**:
  - Extracts race ID from URL query parameter
  - Parses race number from label (regex: `Race (\d+)`)
  - Extracts class name and race label from full label
  - Parses race completion time (optional)
  - Handles grouped races (Main Events, Qualifier Rounds)
  - Stores `race_full_label` field

### RaceResultsParser (`ingestion/connectors/liverc/parsers/race_results_parser.py`)

- **Status**: ✅ **100% Complete**
- **CSS Selectors**: `table.race_result tbody tr`, `td:first-child`,
  `td:nth-child(2) span.driver_name`,
  `td:nth-child(2) a.driver_laps[data-driver-id]`, `td:nth-child(3)` (Qual),
  `td:nth-child(4)` (Laps/Time), `td:nth-child(5)` (Behind), `td:nth-child(6)`,
  `td:nth-child(7) div.hidden`, `td:nth-child(8)`–`td:nth-child(12)` (Avg Top
  5/10/15, Top 3 Consec., Std. Deviation), `td:nth-child(13)` (Consistency)
- **Features**:
  - Extracts driver ID from `data-driver-id` attribute (primary)
  - Falls back to matching driver name to `racerLaps` keys
  - Parses Laps/Time ("47/30:31.382" or "0"): laps count, `total_time_raw`, and
    `total_time_seconds` (MM:SS.mmm → seconds)
  - Extracts Qual (column 3) → `qualifying_position`, Behind (column 5) →
    `seconds_behind`
  - Extracts Avg Top 5, Avg Top 10, Avg Top 15, Top 3 Consecutive, Std.
    Deviation into `raw_fields_json`
  - Handles non-starting drivers (RILEY LANDER case)
  - Extracts fastest lap, avg lap, consistency
- **Race duration**: `parse_race_duration_seconds(html)` parses "Length: MM:SS
  Timed" from the race result page and is used by the connector to set
  `race_summary.duration_seconds`.

### RaceLapParser (`ingestion/connectors/liverc/parsers/race_lap_parser.py`)

- **Status**: ✅ **100% Complete**
- **JavaScript Parsing**: Regex pattern `racerLaps\[(\d+)\]\s*=\s*(\{.*?\});`
- **Features**:
  - Extracts `racerLaps` JavaScript blocks
  - Maps fields correctly: `lapNum` → `lap_number`, `pos` → `position_on_lap`
  - Calculates `elapsed_race_time` as cumulative sum
  - Skips lap 0 (start line)
  - Handles empty laps arrays (non-starting drivers)
  - Parses JavaScript object literals (not JSON-compatible)

### Additional parsers (present in `ingestion/connectors/liverc/parsers/`)

The connector also ships these parser modules. Selector-level detail lives in
the Python modules (and `PARSER_SELECTORS.md` for shared selectors):

- ✅ `entry_list_parser.py` — entry lists grouped by class (test:
  `test_entry_list_parser.py`)
- ✅ `qual_points_parser.py` — qualifying points (test:
  `test_qual_points_parser.py`)
- ✅ `rankings_list_parser.py` — rankings list (test:
  `test_rankings_list_parser.py`)
- ✅ `round_ranking_parser.py` — per-round rankings
- ✅ `overall_final_ranking_parser.py` — overall final ranking (test:
  `test_overall_final_ranking_parser.py`)
- ✅ `multi_main_list_parser.py` / `multi_main_result_parser.py` — multi-main
  (A1/A2/A3) lists and results
- ✅ `track_dashboard_parser.py` — track dashboard metadata enrichment (test:
  `test_track_dashboard_parser.py`)
- ✅ `practice_day_parser.py` — practice day sessions (test:
  `test_practice_day_parser.py`)
- ✅ `entry_list_nav_clusters.py` — entry-list navigation cluster helper (test:
  `test_entry_list_nav_clusters.py`)

Related normalisation helpers (not parsers, but exercised by tests): session
type inference (`test_session_type_inference.py`), vehicle-type inference
(`ingestion/ingestion/infer_vehicle_type.py`), and race-vehicle normalization
(`ingestion/common/race_vehicle_normalization.py`).

## CSS Selectors Used

### TrackListParser

- `table.track_list tbody tr.clickable-row` - Track rows
- `td a[href]` - Track link
- `td a strong` - Track name
- `td:first-child small small` - Last updated

### EventListParser

- `table#events tbody tr` - Event rows
- `td:first-child a[href]` - Event link
- `td:nth-child(2) span.hidden` - Event date (ISO format)
- `td:nth-child(3)` - Entries count
- `td:nth-child(4)` - Drivers count

### EventMetadataParser

- `h3.page-header` - Event name header
- `h5.page-header` - Event date header
- `table.table-sm tbody tr` - Event Stats table rows

### RaceListParser

- `table.entry_list_data tbody tr` - Race rows
- `td a[href*="view_race_result"]` - Race links
- `td:nth-child(2)` - Race completion time

### RaceResultsParser

- `table.race_result tbody tr` - Result rows
- `td:first-child` - Position
- `td:nth-child(2) span.driver_name` - Driver name
- `td:nth-child(2) a.driver_laps[data-driver-id]` - Driver ID (primary)
- `td:nth-child(3)` - Qual (qualifying position)
- `td:nth-child(4)` - Laps/Time (laps count + total time string; time parsed to
  seconds)
- `td:nth-child(5)` - Behind (seconds behind winner)
- `td:nth-child(6)` - Fastest lap
- `td:nth-child(7) div.hidden` - Avg lap
- `td:nth-child(8)`–`(12)` - Avg Top 5, Avg Top 10, Avg Top 15, Top 3
  Consecutive, Std. Deviation (into raw_fields_json)
- `td:nth-child(13)` - Consistency
- Race page: `span.class_sub_header` containing "Length: MM:SS Timed" - race
  duration (via `parse_race_duration_seconds`)

### RaceLapParser

- JavaScript regex: `racerLaps\[(\d+)\]\s*=\s*(\{.*?\});` - Extract driver lap
  data blocks

## Test Fixtures

Fixtures are located in `tests/fixtures/liverc/`:

- `track_catalogue.html` - Global track catalogue
- `canberraoffroad_events.html` - Track events listing
- `486677/event.html` - Event detail page
- `486677/race.6304829.html` - Race results (A-Main)
- `486677/race.6304822.html` - Race results (A3-Main)
- `486677/race.6304830.html` - Race results (B-Main)
- `486677/metadata.json` - Fixture metadata
- `486677/notes.md` - Fixture notes

## Unit Tests

Core parsers have comprehensive unit tests (under `tests/unit/`):

- ✅ `test_track_list_parser.py`
- ✅ `test_event_list_parser.py`
- ✅ `test_event_metadata_parser.py`
- ✅ `test_race_list_parser.py`
- ✅ `test_race_results_parser.py`
- ✅ `test_race_lap_parser.py`
- ✅ `test_entry_list_parser.py` (under `tests/`)
- ✅ `test_qual_points_parser.py`
- ✅ `test_rankings_list_parser.py`
- ✅ `test_overall_final_ranking_parser.py`
- ✅ `test_track_dashboard_parser.py`
- ✅ `test_session_type_inference.py`
- ✅ `test_recent_events_filter.py` (recent-events auto-ingest filter)

Run tests:

```bash
pytest tests/unit/test_*_parser.py -v
```

## Known Edge Cases Handled

1. **Non-starting drivers**: RILEY LANDER case (position 12, 0 laps, no
   data-driver-id)
2. **Empty laps arrays**: Return empty list, don't raise error
3. **Missing driver IDs**: Match by name to racerLaps keys
4. **Race labels without parentheses**: Use entire label as both class_name and
   race_label
5. **Missing race times**: start_time set to None
6. **Grouped races**: Handled correctly (Main Events, Qualifier Rounds)
7. **Lap 0**: Skipped (start line)

## Documentation

- Architecture docs: `docs/architecture/liverc-ingestion/`
- Fixture management:
  `docs/architecture/liverc-ingestion/19-ingestion-fixture-management.md`
- Testing strategy:
  `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`
