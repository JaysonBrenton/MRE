# Practice Day Full Ingestion — Implementation Plan

**Created:** 2026-02-14  
**Design reference:** [docs/architecture/practice-day-full-ingestion-design.md](../architecture/practice-day-full-ingestion-design.md)  
**Owner:** LiveRC Ingestion / Backend  
**Objective:** Implement full practice day ingestion (list + drivers/results from list + session detail + laps) so that a single import persists all captureable metadata. This plan is phased, dependency-ordered, and includes robust documentation and testing.

---

## Executive Summary

This plan implements the behaviour described in the [Practice Day Full Ingestion design](../architecture/practice-day-full-ingestion-design.md): one “import practice day” action will persist the session list, create Driver/RaceDriver/RaceResult per session from list data (with driver identity by transponder when present, including “Unknown Driver”), then fetch each session’s detail page with bounded concurrency and persist end time, extra stats, and lap-by-lap data.

**Phases (8 total, dependency-ordered):** (1) Add `race_metadata` (JSONB) to `races` and sync the SQLAlchemy model. (2) Introduce a driver-identity helper and persist Driver, RaceDriver, and RaceResult from the list. (3) Add repository support to update Race.race_metadata and RaceResult after bulk insert. (4) Implement the detail phase: fetch session detail with a concurrency limit, write race_metadata and result stats, and bulk-insert laps. (5) Extend the ingest API response, add config (e.g. concurrency limit), and extend metrics and logging. (6) Update all affected architecture, operations, API, and index docs in one pass. (7) Add unit, integration, and fixture-based tests for identity, idempotency, partial failure, and unknown drivers. (8) Finalize runbooks, observability, and the release verification checklist.

**Emphasis:** Every phase has explicit exit criteria; documentation (Phase 6) lists every document and the updates required; testing (Phase 7) covers happy path, idempotency, partial detail failure, and no-transponder edge cases. The plan is intended to be executed in order, with Phases 6 and 7 starting once Phase 4 is functionally complete.

---

## 0. Prerequisites and Conventions

- **Codebase authority:** All file paths, method names, and “current state” claims are verified against the repo. When in doubt, grep/read before implementing.
- **Docker-only:** All test and run commands assume execution inside the appropriate container (`mre-liverc-ingestion-service` for Python, `mre-app` for Next.js) unless stated otherwise.
- **Testing:** Follow [docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md). Fixture-based tests must remain deterministic; new fixtures must be committed under `ingestion/tests/fixtures/`.
- **Migrations:** Schema changes use Prisma migrations under `prisma/migrations/` (shared Postgres used by Next.js and ingestion service). The ingestion service uses SQLAlchemy models that must stay in sync with the migrated schema.
- **Documentation:** Every doc touched in this plan is listed in Phase 6 with the exact updates required. No doc left behind.

---

## 1. Phase Overview and Dependencies

| Phase | Description | Depends on |
|-------|-------------|------------|
| **Phase 1** | Schema: add `race_metadata` to Race; sync SQLAlchemy model | — |
| **Phase 2** | Driver identity helper and list-phase persistence (Driver, RaceDriver, RaceResult from list) | Phase 1 |
| **Phase 3** | Repository: Race.race_metadata and RaceResult update support | Phase 1 |
| **Phase 4** | Pipeline: session detail fetch with concurrency; persist detail + laps | Phase 2, 3 |
| **Phase 5** | API response extension; config; metrics and logging | Phase 4 |
| **Phase 6** | Documentation updates (comprehensive) | Phase 4 |
| **Phase 7** | Testing (unit, integration, fixtures, edge cases) | Phase 4 |
| **Phase 8** | Runbooks, observability, and release verification | Phase 6, 7 |

Phases 6 and 7 can be started once Phase 4 is functionally complete; Phase 8 is final.

---

## 2. Phase 1 — Schema and Model

**Goal:** Add `race_metadata` (JSONB, nullable) to `races` and ensure the ingestion service’s Race model and all existing write paths leave it null when not set.

### 2.1 Tasks

1. **Create Prisma migration for `race_metadata`.**
   - Add column: `races.race_metadata` JSONB NULL.
   - Migration file: `prisma/migrations/YYYYMMDDHHMMSS_add_race_metadata/migration.sql`.
   - Content: `ALTER TABLE "races" ADD COLUMN IF NOT EXISTS "race_metadata" JSONB;`
   - Run migration in dev: `docker exec -it mre-app npx prisma migrate deploy` (or equivalent per project conventions). Verify no existing code assumes `races` has a fixed column set that would break.

2. **Update Prisma schema.**
   - In `prisma/schema.prisma`, add to the `Race` model (or equivalent table name):
     - `race_metadata Json? @db.JsonB`
   - Regenerate client if needed: `npx prisma generate`.

3. **Update SQLAlchemy Race model.**
   - File: `ingestion/db/models.py`.
   - Add to `Race` class: `race_metadata = Column("race_metadata", JSONB, nullable=True)` (use existing JSONB import/type if present).
   - Ensure no other code path that constructs or updates `Race` assumes a fixed set of columns; all existing `bulk_upsert_races` and single-race writes must omit `race_metadata` (or set it to None) so it stays null for non-practice races.

4. **Repository: bulk_upsert_races.**
   - File: `ingestion/db/repository.py`.
   - In `bulk_upsert_races`, when building `race_dict` from `race_data`, do **not** add `race_metadata` unless the design explicitly passes it (Phase 3 will add it for practice). So no change in Phase 1 for the bulk insert; only ensure the column exists and the model can read/write it.

5. **Verification.**
   - After migration: query `races` and confirm column exists; existing rows have `race_metadata` NULL.
   - Run existing ingestion tests that touch races to ensure no regressions.

### 2.2 Exit criteria

- [ ] Migration applied; `races.race_metadata` exists and is NULL for all existing rows.
- [ ] SQLAlchemy Race model has `race_metadata`; existing pipeline and repository code paths do not set it (remain null for event/race ingestion).
- [ ] No new linter/type errors; existing tests that create/update Race still pass.

---

## 3. Phase 2 — Driver Identity and List-Phase Persistence

**Goal:** After creating Event and Races (unchanged), for each practice session: compute `source_driver_id` (transponder when present—including “Unknown Driver”—else `practice_session_{session_id}`), upsert Driver, then bulk upsert RaceDrivers and RaceResults using list data (lap_count, fastest_lap, average_lap).

### 3.1 Driver identity helper

1. **Add a small helper (or inline logic) for practice driver source_driver_id.**
   - Location: either a new module under `ingestion/ingestion/` (e.g. `practice_driver_identity.py`) or inside `pipeline.py` as a private function.
   - Signature: `def get_practice_source_driver_id(session_id: str, transponder_number: Optional[str]) -> str`.
   - Logic: if `transponder_number` is present (non-empty string after strip), return it; else return `f"practice_session_{session_id}"`.
   - Document: “Used for practice day ingestion. Transponder when present (including for Unknown Driver); else synthetic per session.”

2. **Unit tests for the helper.**
   - File: e.g. `ingestion/tests/unit/test_practice_driver_identity.py` (or under existing test structure).
   - Cases: transponder present → return transponder; transponder None → `practice_session_{session_id}`; transponder empty string → `practice_session_{session_id}`; “Unknown Driver” with transponder “123” → “123”.

### 3.2 Normalizer usage

- When calling `repo.upsert_driver` for practice, pass `normalized_name=Normalizer.normalize_driver_name(driver_name)`. Reuse the same Normalizer used in race ingestion (see `ingestion/ingestion/normalizer.py`). Ensure Normalizer is imported where needed in the pipeline.

### 3.3 Pipeline changes (list phase only)

1. **Immediately after bulk_upsert_races (and after the existing flush/commit that sets event_id).**
   - Build three lists: `race_drivers_data`, `race_results_data`. You need `race_id` and later `race_driver_id` for each session. The pipeline already has `practice_day_summary.sessions` and the result of `bulk_upsert_races` keyed by `source_race_id` (session_id).
   - For each `session_summary` in `practice_day_summary.sessions`:
     - `source_driver_id = get_practice_source_driver_id(session_summary.session_id, session_summary.transponder_number)`.
     - `driver = repo.upsert_driver("liverc", source_driver_id, session_summary.driver_name, Normalizer.normalize_driver_name(session_summary.driver_name), session_summary.transponder_number)`. Handle IntegrityError/constraint if any (repository may already handle; verify).
     - Append to `race_drivers_data`: `{ "race_id": str(race.id), "driver_id": str(driver.id), "source": "liverc", "source_driver_id": source_driver_id, "display_name": session_summary.driver_name, "transponder_number": session_summary.transponder_number }`. Use the Race instance from the bulk_upsert_races result (keyed by session_summary.session_id).
     - Do not yet append to `race_results_data` (you need race_driver_id from the next step).
   - Call `repo.bulk_upsert_race_drivers(race_drivers_data)`. Capture return value: mapping `(race_id, source_driver_id) -> RaceDriver`. Build a mapping `(session_id, source_driver_id) -> race_driver_id` using the race_id from the Race keyed by session_id.
   - For each session again: build `race_results_data` with `race_id`, `race_driver_id` (from the map), `position_final=1`, `laps_completed=session_summary.lap_count`, `fast_lap_time=session_summary.fastest_lap`, `avg_lap_time=session_summary.average_lap`, and optional fields (total_time_raw, total_time_seconds, consistency) as null if not from list.
   - Call `repo.bulk_upsert_race_results(race_results_data)`. Retain the return mapping `(race_id, race_driver_id) -> RaceResult` for use in Phase 4 (lap persistence needs race_result_id).

2. **Transaction boundaries.**
   - Keep the same transaction/session as the rest of `ingest_practice_day` so that list-phase drivers, race_drivers, and race_results are committed together with the existing Event and Races (e.g. one commit after step 5 in the design, or as currently structured). Do not commit between bulk_upsert_races and bulk_upsert_race_results so that a single rollback can undo everything on failure.

### 3.4 Edge cases

- **Empty sessions list:** If `practice_day_summary.sessions` is empty, skip driver/race_driver/race_result steps; no new code path for “zero sessions” beyond existing behaviour.
- **Duplicate source_driver_id across sessions:** Same transponder in multiple sessions yields the same Driver and multiple RaceDriver rows (one per race_id). Repository bulk upserts handle this.

### 3.5 Exit criteria

- [ ] Helper implemented and unit-tested (transponder vs missing; Unknown Driver with transponder).
- [ ] Pipeline creates Driver, RaceDriver, RaceResult for each session from list data; bulk methods used; race_result_id map retained for Phase 4.
- [ ] Re-import of same practice day: drivers/race_drivers/race_results upserted idempotently (no duplicate key errors).
- [ ] Existing practice day import test (if any) still passes; new test: import a day with at least two sessions, assert Driver count, RaceDriver count, RaceResult count, and that one RaceResult has laps_completed/fast_lap_time/avg_lap_time from list.

---

## 4. Phase 3 — Repository: Race.race_metadata and RaceResult Updates

**Goal:** Support updating `Race.race_metadata` and RaceResult (consistency, raw_fields_json, and optionally laps_completed, fast_lap_time, avg_lap_time) after the initial bulk insert, so the detail phase can write detail data without re-inserting.

### 4.1 Tasks

1. **Update Race by id (race_metadata).**
   - Option A: Add a method `update_race_metadata(race_id: Union[UUID, str], race_metadata: dict) -> None` that does a single-row UPDATE on `races` SET race_metadata = :value WHERE id = :race_id.
   - Option B: In the pipeline, load the Race by id, set `race.race_metadata = {...}`, then `session.flush()` or rely on commit. Prefer a single UPDATE for clarity and to avoid loading full Race.
   - Document: “Used by practice day detail phase to store end_time and practiceSessionStats.”

2. **Update RaceResult by (race_id, race_driver_id).**
   - Repository already has `bulk_upsert_race_results` which does ON CONFLICT update. So you can either:
     - **Option A:** Build a second batch of “updates only” for the same (race_id, race_driver_id) with new fields (consistency, raw_fields_json, laps_completed, fast_lap_time, avg_lap_time) and call `bulk_upsert_race_results` again with that batch (same keys, updated values). PostgreSQL ON CONFLICT DO UPDATE will overwrite. Or
     - **Option B:** Add an explicit `update_race_result_practice_detail(race_id, race_driver_id, consistency, raw_fields_json, laps_completed=None, fast_lap_time=None, avg_lap_time=None)` that runs a single UPDATE.
   - Design doc says “No new methods required if we use existing bulk upserts”; so prefer Option A: build a list of race_result update dicts (same keys as bulk_upsert_race_results input) with race_id, race_driver_id, and updated fields, then call bulk_upsert_race_results again. Ensure the repository’s ON CONFLICT set clause includes consistency, raw_fields_json, laps_completed, fast_lap_time, avg_lap_time (verify existing implementation).

3. **Verify bulk_upsert_race_results update set.**
   - In `ingestion/db/repository.py`, confirm that the `on_conflict_do_update` set for `bulk_upsert_race_results` includes all of: laps_completed, fast_lap_time, avg_lap_time, consistency, raw_fields_json. If any are missing, add them so that a second call with the same (race_id, race_driver_id) updates these fields.

### 4.2 Exit criteria

- [ ] Pipeline (Phase 4) can set Race.race_metadata per session and update RaceResult with detail fields; no new repository method required if bulk upsert is sufficient, otherwise one minimal update method each for Race and RaceResult.
- [ ] Existing race result and lap tests still pass.

---

## 5. Phase 4 — Pipeline: Session Detail Fetch and Laps

**Goal:** For each practice session, fetch the session detail page (with bounded concurrency), persist end_time and practiceSessionStats to Race.race_metadata, update RaceResult with consistency and raw_fields_json (and optionally laps_completed, fast_lap_time, avg_lap_time), and persist laps via bulk_upsert_laps.

### 5.1 Concurrency and throttling

1. **Configurable concurrency limit.**
   - Add a constant or config (e.g. env `PRACTICE_DAY_DETAIL_CONCURRENCY` or a constant in pipeline/config) for max concurrent session-detail fetches. Recommended default: 3–5. Use `asyncio.Semaphore(limit)` (or equivalent) so that at most N detail fetches run at once.
   - Document in operations/runbook: “Practice day import fetches one page per session; concurrency is capped to avoid hammering LiveRC.”

2. **Loop over sessions.**
   - For each session in `practice_day_summary.sessions`, await `connector.fetch_practice_session_detail(track_slug, session_summary.session_id)` inside the semaphore. On success: parse detail; on exception: log warning, record session as “detail_failed”, continue (do not fail the whole day).

### 5.2 Persist detail per session

1. **Race.race_metadata.**
   - Build dict: `{ "end_time": detail.end_time.isoformat() if detail.end_time else None, "practiceSessionStats": { "top_3_consecutive": detail.top_3_consecutive, "avg_top_5": detail.avg_top_5, ... } }` (only include keys that exist in PracticeSessionDetail). Call repository update for race_metadata (Phase 3). Use race_id from the existing Race keyed by session_id.

2. **RaceResult update.**
   - Build raw_fields_json: `{ "top_3_consecutive": detail.top_3_consecutive, "avg_top_5": detail.avg_top_5, "avg_top_10": detail.avg_top_10, "avg_top_15": detail.avg_top_15, "std_deviation": detail.std_deviation, "valid_lap_range": list(detail.valid_lap_range) if detail.valid_lap_range else None }`. Set consistency from detail.consistency. Optionally refresh laps_completed, fast_lap_time, avg_lap_time from detail. Call bulk_upsert_race_results with a list of one-item updates (same race_id, race_driver_id) or the update method from Phase 3.

3. **Laps.**
   - For each lap in `detail.laps`, build a dict: `race_result_id` (from the map: session_id -> race_result_id), `lap_number`, `position_on_lap`, `lap_time_raw`, `lap_time_seconds`, `pace_string`, `elapsed_race_time` (use 0.0 if not set), `segments_json` (lap.segments as list; Lap model expects JSON-serializable). Append to an accumulated list. After all sessions (or in batches if very large), call `repo.bulk_upsert_laps(accumulated_laps)`.

### 5.3 Mapping session_id -> race_result_id

- You have: (session_id -> Race) from bulk_upsert_races; (race_id, source_driver_id) -> RaceDriver; (race_id, race_driver_id) -> RaceResult. For each session, source_driver_id = get_practice_source_driver_id(session_id, transponder); race_id = races_by_source_race_id[session_id].id; race_driver_id = race_drivers[(race_id, source_driver_id)].id; race_result_id = race_results[(race_id, race_driver_id)].id. Build once after list phase and reuse in the detail loop.

### 5.4 Partial failure and idempotency

- If a session’s detail fetch raises: log, increment `sessions_detail_failed`, do not add laps or race_metadata/result update for that session. Continue with other sessions. Final commit still runs; list-phase data for the failed session is already persisted.
- Re-import: detail fetches run again; race_metadata and race_results are updated (upsert); laps are upserted by (race_result_id, lap_number). So re-import is idempotent.

### 5.5 Exit criteria

- [ ] Detail phase runs with bounded concurrency; all successful detail responses lead to race_metadata update, race_result update, and laps appended.
- [ ] One session detail failure does not abort the import; counts (sessions_ingested, sessions_detail_failed, laps_ingested) are accurate.
- [ ] Re-import of the same day overwrites/merges correctly (no duplicate laps, updated stats).
- [ ] Sessions with no transponder: list phase still creates driver/result; detail phase may have empty laps; stats from detail still persisted if available.

---

## 6. Phase 5 — API, Config, Metrics, Logging

**Goal:** Extend ingest API response with optional counts; add config for detail concurrency; add metrics and structured logs for practice day full ingestion.

### 5.1 API response

- **Endpoint:** `POST /api/v1/practice-days/ingest` (ingestion service) and the Next.js proxy that calls it.
- **Response body (success):** Extend `data` to include, when implemented: `sessions_ingested`, `sessions_failed`, `sessions_with_laps` (count of sessions for which at least one lap was written), `laps_ingested`, `drivers_created_or_matched` (optional; count of distinct drivers upserted). Keep existing `event_id`, `status`. Do not remove existing fields; add new ones so clients can stay backward compatible.

### 5.2 Config

- **Environment:** Document `PRACTICE_DAY_DETAIL_CONCURRENCY` (default 3 or 5) in operations docs and in code (constant or env read). If not set, use default.

### 5.3 Metrics

- **Existing:** `record_practice_day_ingestion(track_slug, date, duration_seconds, success, sessions_ingested)`.
- **Add (or extend):** Optional: `sessions_with_laps`, `laps_ingested`, `sessions_detail_failed`. See `ingestion/common/metrics.py` for existing practice day counters; add new labels/counters as needed and document in observability doc.

### 5.4 Logging

- **Structured log at start:** `ingest_practice_day_start` (existing).
- **After list phase:** Log session count, driver count (or “drivers/results created”).
- **After detail phase:** Log sessions_with_laps, laps_ingested, sessions_detail_failed (if any).
- **At end:** `ingest_practice_day_success` (existing) with extended payload if desired.
- **On detail fetch failure:** Log session_id, error message, so operators can correlate.

### 5.5 Exit criteria

- [ ] API response includes new counts; Next.js types updated if it consumes them.
- [ ] Config documented and default applied.
- [ ] Metrics and logs updated; observability doc updated (Phase 6).

---

## 7. Phase 6 — Documentation Updates (Comprehensive)

**Goal:** Update every affected document so that architecture, operations, API, and runbooks reflect full practice day ingestion. No doc left behind.

### 6.1 Architecture

| Document | Updates |
|----------|--------|
| **docs/architecture/practice-day-full-ingestion-design.md** | Set **Status** to *Implemented* (or *In progress*) when implementation is merged; add “Implementation plan: docs/implimentation_plans/practice-day-full-ingestion-implementation-plan.md”. |
| **docs/architecture/liverc-ingestion/04-data-model.md** | Describe `races.race_metadata` (JSONB, nullable): “Used for practice sessions to store end_time and practiceSessionStats. Null for race events.” Add a short subsection on practice day persistence (Driver, RaceDriver, RaceResult, Lap) if not already covered. |
| **docs/architecture/liverc-ingestion/03-ingestion-pipeline.md** (or equivalent pipeline doc) | Add subsection “Practice day full ingestion”: steps (list → drivers/results from list → detail fetch with concurrency → race_metadata + result update + laps). Reference design doc. |
| **docs/architecture/liverc-ingestion/14-ingestion-idempotency-design.md** | State that practice day re-import is idempotent: Event/Races/Drivers/RaceDrivers/RaceResults/Laps are upserted by natural keys; detail re-fetch overwrites race_metadata and result stats and laps. |
| **docs/architecture/liverc-ingestion/15-ingestion-observability.md** | Document new/updated metrics (sessions_with_laps, laps_ingested, sessions_detail_failed) and log events for practice day full ingestion. |
| **docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md** | Add practice day full ingestion to test categories: unit (driver identity helper, normalizer), integration (fixture-based full import), and edge cases (unknown driver with transponder, no transponder, partial detail failure). Reference fixture location. |
| **docs/architecture/liverc-ingestion/19-ingestion-fixture-management.md** | If new fixtures are added (e.g. practice session detail HTML), document path and naming; add practice day fixtures to the list of managed fixtures. |
| **docs/architecture/liverc-ingestion/22-ingestion-versioning-and-migrations.md** | Note migration that adds `race_metadata`; ingestion version bump if applicable per project policy. |

### 6.2 Operations and runbooks

| Document | Updates |
|----------|--------|
| **docs/operations/liverc-operations-guide.md** | Add subsection “Practice day import (full)”. Describe that import now fetches list + per-session detail and persists drivers, results, and laps. Mention `POST /api/v1/practice-days/ingest` and optional response fields (sessions_ingested, laps_ingested, etc.). Note that “Unknown Driver” sessions are differentiated by transponder when present; only when transponder is missing are laps not extracted. Mention concurrency limit (env or default). |
| **docs/operations/docker-user-guide.md** | If any new env vars (e.g. PRACTICE_DAY_DETAIL_CONCURRENCY) are supported, add them to the ingestion service env table or config section. |
| **docs/operations/observability-guide.md** | Point to ingestion observability doc for practice day metrics and logs; add one line on “practice day full ingestion” metrics if there is a metrics summary table. |

### 6.3 API and database

| Document | Updates |
|----------|--------|
| **docs/api/versioning-strategy.md** (or API doc for ingestion) | Document extended response for `POST /api/v1/practice-days/ingest`: new optional fields (sessions_ingested, sessions_failed, sessions_with_laps, laps_ingested, etc.) and that they are additive, non-breaking. |
| **docs/database/schema.md** | Add `race_metadata` to the `races` table description: type JSONB, nullable, “Practice sessions only: end_time, practiceSessionStats.” |

### 6.4 Index and README

| Document | Updates |
|----------|--------|
| **docs/index/document-index.md** | Under Implementation Plans, add link to “Practice Day Full Ingestion Implementation Plan” with short description. Under Architecture, ensure practice-day-full-ingestion-design is listed if not already. |
| **docs/README.md** (if it lists features) | If practice day import is mentioned, update one line to “full ingestion (list + session detail + laps)”. |
| **ingestion/README.md** (if present) | Mention practice day full ingestion and point to design + implementation plan. |

### 6.5 Runbook (new or existing)

- **Practice day import troubleshooting:** Add a short runbook (under docs/operations/ or docs/reviews/) or a section in liverc-operations-guide: “Practice day import: no laps for some sessions” → check transponder present (Unknown Driver often has transponder); “detail fetch failed” → check logs for session_id and HTTP/parse errors; “high latency” → reduce PRACTICE_DAY_DETAIL_CONCURRENCY.

### 6.6 Exit criteria

- [ ] Every document in the tables above is updated and reviewed.
- [ ] Design doc status set to Implemented when code is merged.
- [ ] Document index and cross-references are correct.

---

## 8. Phase 7 — Testing (Robust)

**Goal:** Full coverage for driver identity, list-phase persistence, detail phase (with and without laps), partial failure, idempotency, and unknown driver behaviour. Fixture-based where possible; unit tests for pure logic.

### 8.1 Unit tests

| Test file / scope | Cases |
|-------------------|--------|
| **Driver identity helper** | Transponder present → returns transponder; None/empty → `practice_session_{session_id}`; “Unknown Driver” with transponder “123” → “123”. |
| **Normalizer** | Practice driver name “Unknown Driver” normalized (existing Normalizer tests may cover; add one explicit practice name if needed). |

### 8.2 Integration tests (pipeline)

| Scenario | Setup | Assertions |
|----------|--------|------------|
| **Full import (happy path)** | Mock or fixture: one practice day with 2–3 sessions; at least one session with transponder and one with “Unknown Driver” + transponder. Run `ingest_practice_day`. | Event exists; Races count = session count; Drivers created (transponder as source_driver_id where present); RaceDrivers = sessions; RaceResults = sessions; each result has position_final=1, laps_completed/fast_lap_time/avg_lap_time from list. After detail phase: race_metadata set for each race; RaceResult has consistency/raw_fields_json where detail provided; Laps count > 0 for sessions that have transponder and detail with laps. |
| **Idempotency** | Same day imported twice. | No duplicate drivers/race_drivers/race_results/laps; counts unchanged or updated (e.g. laps overwritten). |
| **Partial detail failure** | Mock: one session’s fetch_practice_session_detail raises. | Import completes; sessions_ingested = all; sessions_detail_failed = 1; list-phase data for failed session present (driver, race_driver, race_result); no laps for that session; other sessions have laps if available. |
| **No transponder** | One session with transponder_number None. | Driver created with source_driver_id `practice_session_{session_id}`; RaceResult created from list; detail phase runs but laps for that session = 0 (parser skips lap extraction). |
| **Empty sessions** | Practice day with 0 sessions. | Event created; 0 Races; no drivers/results/laps; no errors. |

### 8.3 Fixtures

| Fixture | Purpose |
|---------|---------|
| **Practice day list HTML** | Already present or add: `ingestion/tests/fixtures/liverc/practice/canberraoffroad-day-2025-10-25.html` (or similar) for parse_practice_day_overview. |
| **Practice session detail HTML** | At least one: session with laps (transponder in HTML so lap parser can extract). File name e.g. `canberraoffroad-session-21290331.html`. Use in tests that run parse_practice_session_detail and in integration tests that mock fetch_practice_session_detail to return a parsed PracticeSessionDetail. |
| **Minimal session detail (no laps)** | Optional: session HTML with no transponder or no lap data, to assert laps = 0 and stats still persisted. |

### 8.4 Parser tests

| Test | Cases |
|------|--------|
| **parse_practice_session_detail** | Existing test; extend if needed: assert consistency, raw_fields_json-shaped fields, valid_lap_range, and laps list when transponder present. |
| **parse_practice_day_overview** | Existing test; ensure transponder_number and lap_count, fastest_lap, average_lap are asserted for at least one session. |

### 8.5 Repository tests

- **bulk_upsert_race_results** (if changed): Second call with same (race_id, race_driver_id) updates consistency, raw_fields_json, laps_completed, fast_lap_time, avg_lap_time.
- **Race.race_metadata**: If you added an update method, test that updating race_metadata for a race leaves other columns unchanged.

### 8.6 Exit criteria

- [ ] All unit tests pass; driver identity and edge cases covered.
- [ ] At least one integration test runs full ingest_practice_day with mocked/fixture data and asserts Event, Races, Drivers, RaceDrivers, RaceResults, Laps and counts.
- [ ] Idempotency test: two imports, no duplicates, correct counts.
- [ ] Partial failure test: one session detail fails, rest succeed; no crash.
- [ ] Fixtures committed and referenced in tests; fixture management doc updated (Phase 6).
- [ ] Run tests in container: `docker exec -it mre-liverc-ingestion-service pytest ingestion/tests/ -v --tb=short` (or project equivalent); all pass.

---

## 9. Phase 8 — Runbooks, Observability, Release Verification

**Goal:** Final runbook entries, observability checklist, and a short release verification checklist so ops and support can operate and troubleshoot practice day full ingestion.

### 9.1 Runbook

- **Practice day import (full):** Already covered in Phase 6 (operations guide). Add “Verification” step: after import, query DB for event by source_event_id; count races, race_drivers, race_results, laps; spot-check one session’s race_metadata and race_result.raw_fields_json.
- **Troubleshooting:** “No laps for a session” → check transponder in list/detail; “Import slow” → check PRACTICE_DAY_DETAIL_CONCURRENCY and site policy throttling; “Detail fetch failed” → logs for session_id and error.

### 9.2 Observability

- **Dashboards/alerts:** If the project uses dashboards for ingestion, add (or document) panels for practice_day_ingestion_* metrics (duration, success/failure, sessions_ingested, laps_ingested, sessions_detail_failed). Alerts: optional on high failure rate or high latency.
- **Logs:** Confirm structured logs are queryable by event (e.g. ingest_practice_day_success, practice_session_ingestion_error, or detail_fetch_failed); document in observability guide.

### 9.3 Release verification checklist

- [ ] Migration applied on target env; races.race_metadata present.
- [ ] Import one known practice day (e.g. Canberra 2025-10-25) end-to-end via UI or API.
- [ ] DB: Event + N Races + N RaceDrivers + N RaceResults + Laps; at least one Race has race_metadata; at least one RaceResult has raw_fields_json with practice stats.
- [ ] Re-import same day; no errors; counts/idempotency as expected.
- [ ] Docs and runbooks updated and linked from index.
- [ ] Tests green in CI.

---

## 10. Summary Checklist (High Level)

- [x] **Phase 1:** Migration + Race.race_metadata; model and repo compatible.
- [x] **Phase 2:** Driver identity helper; list-phase Driver/RaceDriver/RaceResult; tests.
- [x] **Phase 3:** Race.race_metadata and RaceResult update path (bulk or single).
- [x] **Phase 4:** Detail fetch with concurrency; race_metadata + result update + laps; partial failure handling.
- [x] **Phase 5:** API response extension; config; metrics and logging.
- [x] **Phase 6:** All listed documentation updated; design doc status set.
- [x] **Phase 7:** Unit, integration, fixture, and edge-case tests passing.
- [x] **Phase 8:** Runbooks and release verification complete.

**Driver class:** The design requires capturing each driver's class from LiveRC. This is implemented: the list and detail parsers extract `class_name` (PracticeSessionSummary/PracticeSessionDetail); the pipeline passes `s.class_name` into `races_data` so **Race.class_name** is persisted. Integration tests assert that `Race.class_name` is set. See design doc §2.2.1.

---

## 11. References

- Design: [docs/architecture/practice-day-full-ingestion-design.md](../architecture/practice-day-full-ingestion-design.md)
- Ingestion testing: [docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md)
- Ingestion fixtures: [docs/architecture/liverc-ingestion/19-ingestion-fixture-management.md](../architecture/liverc-ingestion/19-ingestion-fixture-management.md)
- Ingestion versioning/migrations: [docs/architecture/liverc-ingestion/22-ingestion-versioning-and-migrations.md](../architecture/liverc-ingestion/22-ingestion-versioning-and-migrations.md)
- Pipeline code: `ingestion/ingestion/pipeline.py` (`ingest_practice_day`)
- Repository: `ingestion/db/repository.py`
- Models: `ingestion/db/models.py`, `ingestion/connectors/liverc/models.py`
- Connector: `ingestion/connectors/liverc/connector.py` (`fetch_practice_session_detail`)
- Parser: `ingestion/connectors/liverc/parsers/practice_day_parser.py` (`parse_practice_session_detail`)
