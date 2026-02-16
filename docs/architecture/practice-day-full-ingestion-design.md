# Practice Day Full Ingestion — Design Document

**Status:** Implemented  
**Last updated:** 2026-02-14  
**Implementation plan:** [docs/implimentation_plans/practice-day-full-ingestion-implementation-plan.md](../implimentation_plans/practice-day-full-ingestion-implementation-plan.md)  
**Scope:** Persist all practice-day metadata when importing a practice day: list-level data, session detail (stats and laps), drivers, and results. No guessing; all assertions are grounded in the current codebase.

---

## Executive Summary

**Current behaviour:** Importing a practice day creates one Event and one Race per session from the LiveRC session list only. Per-session data we already parse (transponder, lap count, fastest/average lap) is dropped. Session detail pages (one per session, with full stats and lap-by-lap data) are never fetched. No Driver, RaceDriver, RaceResult, or Lap rows are written for practice.

**Proposed behaviour:** A single “import practice day” action will (1) keep the existing list fetch and Event + Race creation; (2) create Driver, RaceDriver, and RaceResult for each session using list data (transponder, lap count, fast/avg lap); (3) fetch each session’s detail page with bounded concurrency; (4) persist end time and extra stats (via a new Race `race_metadata` JSONB column and RaceResult `raw_fields_json`), and all laps via existing `bulk_upsert_laps`. Unknown drivers are ingested with display name “Unknown Driver” but **differentiated by transponder** when present (so laps can still be extracted); only when transponder is missing do we use a synthetic id and skip lap extraction.

**Design choices:** Reuse existing Driver/RaceDriver/RaceResult/Lap models and repository bulk upserts; add one optional column (`race_metadata` on Race) for practice-only fields. Driver identity = transponder when present (including for Unknown Driver), else `practice_session_{session_id}`. Idempotent re-import and partial failure (e.g. one session detail fails) are supported; throttling limits concurrent detail fetches.

---

## 1. Overview

### 1.1 Purpose

Today, practice day import creates one **Event** and one **Race** per practice session (from the session list page only). It does **not** persist:

- Per-session fields already parsed from the list (transponder, lap count, fastest lap, average lap).
- Any data from the **session detail** page (the page reached by clicking a driver/session link): end time, full stats (top 3 consecutive, avg top 5/10/15, std deviation, consistency, valid lap range), or lap-by-lap data.
- **Driver** or **RaceDriver** or **RaceResult** or **Lap** rows for practice sessions.

This design describes a solution to persist **all** captureable practice-day data when the user imports a practice day.

### 1.2 Goals

- Persist every metadata field we can capture from the LiveRC practice session list and session detail pages.
- **Capture each driver's class:** Class must be extracted from LiveRC (list and detail pages) and persisted to `Race.class_name` so practice sessions are associated with the correct class for dashboard filtering and leaderboards. See §2.2.1.
- Reuse existing DB models (Driver, RaceDriver, RaceResult, Lap) and repository methods where they fit; extend schema only where necessary.
- Keep a single “import practice day” flow: one user action triggers full capture (list + detail + laps).
- Preserve idempotency and locking behaviour consistent with current practice day and event ingestion.
- Respect site policy and throttling when fetching many session-detail pages per day.

### 1.3 Non-goals

- Changing the Event Search or Practice Days UI beyond what’s needed to show/use the new data.
- Ingesting “Practice Leaderboard” or “Laps-by-Class” from the list page unless we add parser support (current parser does not extract these).
- Lap annotation derivation for practice sessions (can be a follow-up).

---

## 2. Current State (Verified in Code)

### 2.1 Data sources

1. **Session list page**  
   URL pattern: `https://{track_slug}.liverc.com/practice/?p=session_list&d=YYYY-MM-DD`  
   Fetched by: `LiveRCConnector.fetch_practice_day_overview(track_slug, practice_date)`  
   Parsed by: `PracticeDayParser.parse_practice_day_overview(html, track_slug, practice_date)`  
   Returns: `PracticeDaySummary` (day-level stats + list of `PracticeSessionSummary` per row).

2. **Session detail page**  
   URL pattern: `https://{track_slug}.liverc.com/practice/?p=view_session&id={session_id}`  
   Fetched by: `LiveRCConnector.fetch_practice_session_detail(track_slug, session_id)`  
   Parsed by: `PracticeDayParser.parse_practice_session_detail(html, session_id)`  
   Returns: `PracticeSessionDetail` (full session stats + list of `ConnectorLap`).  
   **Important:** Lap extraction uses `RaceLapParser._extract_driver_laps_data(html, transponder_number)`. If `transponder_number` is missing, the parser does not attempt lap extraction and `detail.laps` is empty (`practice_day_parser.py` lines 641–662). “Unknown Driver” is a **display name** only; such sessions often still have a transponder in the list/detail, so we ingest them as unknown drivers differentiated by transponder and can still extract laps when transponder is present.

### 2.2 Connector models (ingestion/connectors/liverc/models.py)

- **PracticeSessionSummary** (list): `session_id`, `driver_name`, `class_name`, `transponder_number`, `start_time`, `duration_seconds`, `lap_count`, `fastest_lap`, `average_lap`, `session_url`.
- **PracticeSessionDetail** (detail): `session_id`, `driver_name`, `class_name`, `transponder_number`, `date`, `start_time`, `end_time`, `duration_seconds`, `lap_count`, `fastest_lap`, `top_3_consecutive`, `average_lap`, `avg_top_5`, `avg_top_10`, `avg_top_15`, `std_deviation`, `consistency`, `valid_lap_range`, `laps: List[ConnectorLap]`.
- **ConnectorLap**: `lap_number`, `position_on_lap`, `lap_time_seconds`, `lap_time_raw`, `pace_string`, `elapsed_race_time`, `segments`.

#### 2.2.1 Driver class — must capture from LiveRC

**We must capture each driver's class for practice days.** The driver's class (e.g. 1/8 Buggy, 4WD SCT) is required for dashboard class filtering, leaderboards, and comparison.

- **Source:** LiveRC provides class on both the **session list** page (`PracticeSessionSummary.class_name`) and the **session detail** page (`PracticeSessionDetail.class_name`). The list and detail parsers in `practice_day_parser.py` must extract `class_name` from the HTML (e.g. class column in the session list table; class field on the detail page).
- **Persistence:** The pipeline must persist the driver's class to **Race.class_name** when creating each practice session Race. Race already has a `class_name` column; practice-day ingestion must set it from the connector model so that each session is associated with the correct class.
- **Use:** Stored class enables the event analysis dashboard (and any practice-day dashboard) to filter and group by class, show class leaderboards, and compare drivers within the same class. Do not drop or omit class when ingesting practice days.

### 2.3 What the pipeline currently persists (ingestion/ingestion/pipeline.py, ingest_practice_day)

- **Event:** `source`, `source_event_id`, `track_id`, `event_name`, `event_date`, `event_entries=0`, `event_drivers`, `event_url`, `event_metadata.practiceDayStats` (totalLaps, totalTrackTimeSeconds, uniqueDrivers, uniqueClasses, timeRangeStart, timeRangeEnd).
- **Race (per session):** `event_id`, `source`, `source_race_id`, `class_name`, `race_label` (“Practice - {driver_name}”), `race_url`, `start_time`, `duration_seconds`, `session_type="practiceday"`.

Not persisted from list: `transponder_number`, `lap_count`, `fastest_lap`, `average_lap` (all present in `PracticeSessionSummary`). Not fetched or persisted: any session detail data or laps.

### 2.4 DB models relevant to practice (ingestion/db/models.py)

- **Event:** id, source, source_event_id, track_id, event_name, event_date, event_entries, event_drivers, event_url, ingest_depth, last_ingested_at, event_metadata (JSONB), created_at, updated_at. No schema change needed for practice.
- **Race:** id, event_id, source, source_race_id, class_name, race_label, race_order, race_url, start_time, duration_seconds, session_type. **No** columns for lap_count, end_time, transponder, or extra stats.
- **Driver:** id, source, source_driver_id, display_name, normalized_name, transponder_number, created_at, updated_at. Unique on (source, source_driver_id). Suitable for practice drivers.
- **RaceDriver:** id, race_id, driver_id, source, source_driver_id, display_name, transponder_number, created_at, updated_at. Unique on (race_id, source_driver_id). One per driver per race; for practice, one per session.
- **RaceResult:** id, race_id, race_driver_id, position_final, laps_completed, total_time_raw, total_time_seconds, fast_lap_time, avg_lap_time, consistency, qualifying_position, seconds_behind, raw_fields_json, created_at, updated_at. For practice we have exactly one result per session (single driver).
- **Lap:** id, race_result_id, lap_number, position_on_lap, lap_time_raw, lap_time_seconds, pace_string, elapsed_race_time, segments_json, created_at, updated_at. Natural key (race_result_id, lap_number). Practice detail parser sets `elapsed_race_time=0.0` for ConnectorLap when not available.

### 2.5 Repository methods (ingestion/db/repository.py)

- `upsert_driver(source, source_driver_id, display_name, normalized_name=None, transponder_number=None)` — use for practice drivers.
- `bulk_upsert_races(races_data)` — already used; races_data includes event_id, source, source_race_id, class_name, race_label, race_order, race_url, start_time, duration_seconds, session_type.
- `bulk_upsert_race_drivers(race_drivers_data)` — expects list of dicts with race_id, driver_id, source, source_driver_id, display_name, transponder_number (optional). Assumes drivers already exist.
- `bulk_upsert_race_results(race_results_data)` — expects race_id, race_driver_id, position_final, laps_completed, total_time_raw, total_time_seconds, fast_lap_time, avg_lap_time, consistency, qualifying_position, seconds_behind, raw_fields_json.
- `bulk_upsert_laps(laps)` — expects list of dicts with race_result_id, lap_number, position_on_lap, lap_time_raw, lap_time_seconds, pace_string, elapsed_race_time, segments_json.

Normalizer is used for race ingestion (driver name normalization); we should use the same for practice driver display names when building `normalized_name` for `upsert_driver`.

---

## 3. Gap: What Must Be Persisted

### 3.1 From session list only (already parsed)

| Field | Current storage | Target |
|-------|------------------|--------|
| transponder_number (per session) | Not stored | Driver.transponder_number, RaceDriver.transponder_number |
| lap_count (per session) | Not stored | RaceResult.laps_completed (one result per session) |
| fastest_lap (per session) | Not stored | RaceResult.fast_lap_time |
| average_lap (per session) | Not stored | RaceResult.avg_lap_time |

Persisting these requires: for each session, resolve or create a **Driver**, create **RaceDriver**, create **RaceResult** (position_final=1, laps_completed, fast_lap_time, avg_lap_time from list). No schema change.

### 3.2 From session detail (fetched per session)

| Field | Target storage |
|-------|----------------|
| end_time | Race: new column or Race metadata (see §4.1). |
| lap_count (detail) | RaceResult.laps_completed (can overwrite list value). |
| fastest_lap, average_lap | RaceResult (can overwrite list). |
| top_3_consecutive, avg_top_5, avg_top_10, avg_top_15, std_deviation, valid_lap_range | RaceResult.raw_fields_json (practice-specific). |
| consistency | RaceResult.consistency. |
| laps[] | Lap rows under the session’s RaceResult. |

Lap rows: use existing `bulk_upsert_laps` with dicts containing race_result_id, lap_number, position_on_lap, lap_time_raw, lap_time_seconds, pace_string, elapsed_race_time, segments_json (segments from ConnectorLap as list → JSON-serializable; Lap.segments_json is JSONB).

### 3.3 Driver identity for practice

Practice has no entry list. We need a stable **source_driver_id** per driver for `(source="liverc", source_driver_id)` so that:

- The same person (or same transponder) across multiple sessions maps to one Driver.
- **Unknown drivers** (display name “Unknown Driver”) are ingested as such but **differentiated by transponder**: they will typically still have a transponder number on the list/detail page, so we use transponder as their identity. That gives one Driver per transponder, allows lap extraction from the detail page, and avoids merging different unknown drivers.
- Sessions with **no transponder at all** still get a Driver and RaceDriver without colliding.

**Proposal:**

- When **transponder_number** is present: use it as **source_driver_id** for LiveRC practice, **including when the display name is “Unknown Driver”**. Same transponder ⇒ same Driver across sessions and days. Ingest with `display_name` as given (e.g. “Unknown Driver”); lap extraction will work because the parser uses transponder.
- When **transponder_number** is missing: use a synthetic id `practice_session_{session_id}` so each session has exactly one driver identity; re-imports remain idempotent per session. Lap extraction will be skipped for that session (no transponder to key on).

Normalized name: use `Normalizer.normalize_driver_name(driver_name)` (same as race ingestion) when calling `upsert_driver`.

---

## 4. Schema and Storage Decisions

### 4.1 Race: extra practice-only fields

**Option A — Add columns to Race:**  
Add `end_time`, `lap_count` (or rely on RaceResult.laps_completed). Possible but mixes practice-only semantics into Race.

**Option B — Race metadata JSONB:**  
Add a single optional column `race_metadata` (JSONB) on `races`. For practice sessions only, store e.g.:

- `end_time` (ISO string or null)
- `practiceSessionStats`: { top_3_consecutive, avg_top_5, avg_top_10, avg_top_15, std_deviation, valid_lap_range }

RaceResult.raw_fields_json already exists; we can put practice-only result-level stats there (top_3_consecutive, avg_top_5, etc.) and keep Race for core fields. So we only need a place for **end_time** and optionally other race-level practice fields. Recommendation: add **race_metadata** (JSONB, nullable) to Race; for practice, store `{ "end_time": "<iso>", "practiceSessionStats": { ... } }`. Existing races leave it null. No new columns on RaceResult beyond using raw_fields_json.

**Chosen:** Add **race_metadata** (JSONB, nullable) to Race. Persist end_time and any other session-level practice stats that don’t fit existing columns there. Use RaceResult.raw_fields_json for detail-only result fields (top_3_consecutive, avg_top_5, avg_top_10, avg_top_15, std_deviation, valid_lap_range).

### 4.2 Event metadata

Keep using `event_metadata.practiceDayStats` for day-level stats. No change.

### 4.3 Summary of persistence targets

| Data | Persist where |
|------|----------------|
| Day-level (existing) | Event + event_metadata.practiceDayStats |
| Per-session: core (existing) | Race (event_id, source_race_id, class_name, race_label, race_url, start_time, duration_seconds, session_type) |
| Per-session: end_time, optional session stats | Race.race_metadata (new column) |
| Driver identity | Driver (source=liverc, source_driver_id=transponder when present—including for “Unknown Driver”—else practice_session_{session_id}) |
| Session–driver link | RaceDriver (race_id, driver_id, source, source_driver_id, display_name, transponder_number) |
| Session “result” (one per session) | RaceResult (race_id, race_driver_id, position_final=1, laps_completed, fast_lap_time, avg_lap_time, consistency; raw_fields_json for top_3, avg_top_5/10/15, std_deviation, valid_lap_range) |
| Lap-level | Lap (race_result_id, lap_number, position_on_lap, lap_time_raw, lap_time_seconds, pace_string, elapsed_race_time, segments_json) |

---

## 5. Flow: Full Practice Day Import

### 5.1 High-level steps

1. **Lock and fetch list** (unchanged): Acquire source_event_id lock, fetch practice day overview, create or update Event, flush so event_id is set.
2. **Create Race rows** (extended): For each `PracticeSessionSummary`, upsert Race (include any list-derived fields we add to Race; today only existing columns). Flush/commit so race IDs exist.
3. **Resolve drivers** (new): For each session, determine source_driver_id: **transponder when present** (including when driver_name is “Unknown Driver”), else `practice_session_{session_id}`. Call `repo.upsert_driver("liverc", source_driver_id, driver_name, normalized_name, transponder_number)`. Batch or sequential as needed to avoid unique constraint races.
4. **Create RaceDrivers and RaceResults from list** (new): For each session, build RaceDriver (race_id, driver_id, source, source_driver_id, display_name, transponder_number) and RaceResult (race_id, race_driver_id, position_final=1, laps_completed=session_summary.lap_count, fast_lap_time=session_summary.fastest_lap, avg_lap_time=session_summary.average_lap). Use bulk_upsert_race_drivers and bulk_upsert_race_results; order: drivers first, then race_drivers, then race_results (repository assumes drivers exist).
5. **Fetch session detail and persist detail + laps** (new): For each session (optionally with bounded concurrency to respect site policy), call `connector.fetch_practice_session_detail(track_slug, session_id)`. For each detail:
   - Update Race: set race_metadata (end_time, practiceSessionStats) per §4.1.
   - Update RaceResult: laps_completed, fast_lap_time, avg_lap_time, consistency, raw_fields_json (top_3_consecutive, avg_top_5, avg_top_10, avg_top_15, std_deviation, valid_lap_range).
   - Build lap dicts keyed by race_result_id (we have one result per session): from detail.laps, produce list of { race_result_id, lap_number, position_on_lap, lap_time_raw, lap_time_seconds, pace_string, elapsed_race_time, segments_json }. Append to an accumulated list. After all sessions (or in batches), call `repo.bulk_upsert_laps(accumulated_laps)`.
6. **Commit and release lock**: Single commit at end or batched commits as today; release source_event_id advisory lock.

### 5.2 Order of repository calls (per batch or full day)

1. upsert_event / event update (existing)  
2. bulk_upsert_races (existing)  
3. For each session: upsert_driver (new)  
4. bulk_upsert_race_drivers (new)  
5. bulk_upsert_race_results (new) — requires race_id and race_driver_id; race_driver_id from step 4  
6. For each session: fetch_practice_session_detail (new)  
7. Update Race.race_metadata (new, if we add column) and RaceResult (consistency, raw_fields_json, optionally laps_completed/fast/avg from detail)  
8. bulk_upsert_laps (new) — requires race_result_id from step 5 (and step 7 if we update results in same transaction)  
9. Commit; release lock  

Race_result_id is required for laps. We get it from bulk_upsert_race_results return value: mapping (race_id, race_driver_id) → RaceResult; for practice, race_driver_id is the same as the single driver we created per session. So we can build (race_id, source_driver_id) → race_result_id from the bulk_upsert_race_drivers and bulk_upsert_race_results results (race_driver_id from race_drivers map, then race_result from results map).

### 5.3 Concurrency and throttling

- Session detail: one HTTP request per session (e.g. 50+ per day). Use bounded concurrency (e.g. semaphore or pool limit) and existing site policy/throttle in the connector so we don’t hammer LiveRC.
- Run detail fetches in a loop with a limit (e.g. 3–5 concurrent) or sequentially; prefer async with a small concurrency bound.

### 5.4 Idempotency and partial failure

- Re-import the same practice day: Event and Races are upserted by (source, source_event_id) and (event_id, source_race_id). Drivers by (source, source_driver_id); RaceDrivers by (race_id, source_driver_id); RaceResults by (race_id, race_driver_id); Laps by (race_result_id, lap_number). All repository methods are upserts, so re-run should overwrite/merge.
- If a session detail fetch fails: log and optionally retry; for that session, leave RaceResult with list-only data and laps empty. Don’t fail the whole day.
- If lap extraction fails (e.g. missing transponder): detail.laps may be empty; persist what we have (stats, no laps).

### 5.5 Lap annotation derivation

Current derivation (`run_derivation_for_race`) expects race data with results and laps. We could call it for practice race IDs after laps are written, or leave practice out of derivation in v1. Design decision: document as optional follow-up; not required for “capture all data.”

---

## 6. API and Response

- Keep existing `POST /api/v1/practice-days/ingest` contract (track_id, date). Response can extend to include counts: e.g. `sessions_ingested`, `sessions_failed`, `sessions_with_laps`, `laps_ingested`, `drivers_created_or_matched`, so the client can show a richer summary. Optional; not a breaking change if we only add fields.

---

## 7. Implementation Checklist

- [ ] **DB migration:** Add `race_metadata` (JSONB, nullable) to `races` if chosen; document in migration.
- [ ] **Pipeline – list phase:** After bulk_upsert_races, for each PracticeSessionSummary: compute source_driver_id (transponder when present—including for “Unknown Driver”—else `practice_session_{session_id}`); upsert_driver with Normalizer.normalize_driver_name; collect race_drivers_data and race_results_data (using list lap_count, fastest_lap, average_lap). Call bulk_upsert_race_drivers then bulk_upsert_race_results; retain race_id and race_driver_id (and thus race_result_id) for each session.
- [ ] **Pipeline – detail phase:** For each session (with concurrency limit), fetch_practice_session_detail. Update Race.race_metadata (end_time, practiceSessionStats). Update RaceResult (consistency, raw_fields_json with top_3, avg_top_5/10/15, std_deviation, valid_lap_range; optionally refresh laps_completed, fast_lap_time, avg_lap_time from detail). Build lap list from detail.laps (map to race_result_id via session_id → race → race_result). bulk_upsert_laps for accumulated laps.
- [ ] **Repository:** No new methods required if we use existing bulk upserts; add optional support for updating Race.race_metadata and RaceResult by (race_id, race_driver_id) if we don’t already have an update path for those after bulk insert (upsert semantics already update on conflict).
- [ ] **Connector/Parser:** No change; fetch_practice_session_detail and parse_practice_session_detail already exist. Confirm ConnectorLap.segments is list (for segments_json); practice parser passes segments from lap_dict.get("segments", []).
- [ ] **Tests:** Unit tests for source_driver_id choice (transponder when present—including “Unknown Driver”—else practice_session_{session_id}); integration test that full import creates Event, Races, Drivers, RaceDrivers, RaceResults, Laps; fixture-based test for parse_practice_session_detail + persistence shape.
- [ ] **Docs:** Update operations/ingestion docs to describe “full” practice day import (list + detail + laps) and any new metrics/counters.

---

## 8. Risks and Notes

- **Transponder required for laps:** Lap extraction keys on transponder. “Unknown Driver” is a display name; such sessions often still have a transponder, so we ingest them as unknown drivers differentiated by transponder and laps can be extracted. Only when transponder is truly missing is lap extraction skipped (stats from the detail page can still be persisted). Document in runbooks.
- **Volume:** A day with 50+ sessions implies 50+ detail page fetches. Throttling and concurrency limits are necessary; consider a configurable limit or “list-only” mode for very large days if needed later.
- **Race.race_metadata:** New column; ensure all existing code paths that insert/update Race leave it null when not set.

---

## 9. References

- Session list URL: `ingestion/connectors/liverc/utils.py` (`build_practice_day_url`), `build_practice_session_url`.
- List parser: `ingestion/connectors/liverc/parsers/practice_day_parser.py` (`parse_practice_day_overview`, `parse_practice_session_detail`).
- Connector: `ingestion/connectors/liverc/connector.py` (`fetch_practice_day_overview`, `fetch_practice_session_detail`).
- Pipeline: `ingestion/ingestion/pipeline.py` (`ingest_practice_day`).
- Models: `ingestion/db/models.py` (Event, Race, Driver, RaceDriver, RaceResult, Lap); `ingestion/connectors/liverc/models.py` (PracticeSessionSummary, PracticeSessionDetail, ConnectorLap).
- Repository: `ingestion/db/repository.py` (upsert_driver, bulk_upsert_races, bulk_upsert_race_drivers, bulk_upsert_race_results, bulk_upsert_laps).
- Race lap parser (detail laps): `ingestion/connectors/liverc/parsers/race_lap_parser.py` (`_extract_driver_laps_data(html, transponder_number)`).
