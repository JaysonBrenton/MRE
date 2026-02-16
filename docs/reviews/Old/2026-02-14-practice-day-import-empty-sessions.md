# Practice Day Import: Event Saved but No Sessions/Races/Laps

**Date:** 2026-02-14  
**Context:** User imported Canberra practice days (e.g. Sep 27, Aug 23, 2025). DB had Event + metadata (correct session/lap/driver counts) but **0 races, 0 event_entries, 0 event_race_classes, 0 laps**.

---

## Root cause (confirmed)

The LiveRC **practice day session list page** is likely **JavaScript-rendered**. The connector used **HTTPX only** for that URL (no Playwright fallback). HTTPX gets the initial HTML, which often does **not** contain the session table (`table.practice_session_list`) or has an empty table. The parser then either:

- Raises **EventPageFormatError** (“No practice session table found”), or  
- Finds a table with **no rows** and returns `sessions=[]`, `total_laps=0`, `unique_drivers=0`.

So when ingest ran, the overview fetch returned **no session rows**. The pipeline still creates/updates the **Event** and sets **metadata** from that overview. When `practice_day_summary.sessions` is empty, it **does not** create Race/Driver/Result/Lap rows. So we get: **Event + metadata (which can be zeros) and 0 races/laps.**

When the overview returns **empty sessions**, the pipeline still creates/updates the Event and sets `metadata.practiceDayStats` from that same overview (so you may see zeros there). In some cases non-zero metadata can appear (e.g. from a prior run or different response). Regardless, **no session list means no Race/Driver/Result/Lap rows**. The fix is to **always get the session list** by adding a **Playwright fallback** for the practice day overview URL.

---

## Fix applied

- **Playwright fallback** in `LiveRCConnector.fetch_practice_day_overview`:
  - Try HTTPX first and parse.
  - If the parser raises **EventPageFormatError** (e.g. no table), or returns **session_count == 0**, retry with **Playwright** using `wait_for_selector="table.practice_session_list"`.
  - Cache the URL as “requires Playwright” so future requests for that date use Playwright and get the full session list.
- **Lap data: use transponder from session list** when falling back to racerLaps lookup (see below).
- **Lap data: parse lapsObj on practice detail pages** (2026-02-14): Practice **view_session** pages use `var lapsObj = [{"x":"1","lap_time":"44.564",...}, ...]` in the Lap-by-Lap Graph script, **not** `racerLaps[transponder]`. We now extract and parse `lapsObj` first so lap-by-lap times are persisted; we fall back to `racerLaps[transponder]` if `lapsObj` is absent.
- **Logging** in the pipeline records `session_count` and warns when stats are non-zero but sessions are empty.

Re-importing a practice day after these changes should create Event + all Race/Driver/Result/Lap rows and full lap data.

---

## What we get from the practice session detail page (view_session)

For each session we fetch `.../practice/?p=view_session&id={session_id}` and persist:

| Source on page | Extracted | Persisted to |
|----------------|-----------|--------------|
| Table: Driver, Class, Transponder | ✓ | Already from list; detail used for validation / lap key |
| Table: Session Time (Date, Start, End, Length) | ✓ | Race `race_metadata.end_time`, duration |
| Table: Num Laps, Fastest Lap, Top 3 Consec | ✓ | RaceResult (laps_completed, fast_lap_time), Race `race_metadata.practiceSessionStats` |
| Table: Averages (Avg, Top 5, Top 10, Top 15, Std Deviation, Consistency) | ✓ | RaceResult.raw_fields_json, Race.race_metadata, consistency |
| Table: Valid Lap Range | ✓ | Race.race_metadata.practiceSessionStats |
| JS: **lapsObj** (Lap 1: 44.564, Lap 2: …) | ✓ (as of 2026-02-14) | Lap rows (lap_number, lap_time_seconds, lap_time_raw, etc.) |

We do **not** persist: date_time_display / time_display per lap, is_valid per lap (could be added later as lap annotation).

---

## Expected behaviour

When you click **Import** on a practice day:

1. Next.js calls `POST /api/v1/practice-days/ingest` with `track_id` and `date`.
2. The ingestion service runs `ingest_practice_day()` which:
   - Fetches the practice day **overview** from LiveRC (session list page).
   - Creates/updates one **Event** with `metadata.practiceDayStats` (totalLaps, uniqueDrivers, etc.).
   - If the overview has **sessions** (list of rows): creates **Race** per session, **Driver** / **RaceDriver** / **RaceResult**, then fetches each **session detail** and persists **Lap** data.
   - Commits in a **single transaction** (event + races + drivers + results + laps together).

So a successful import should create: 1 Event, N Races (sessions), N Drivers/RaceDrivers/RaceResults, and Lap rows. If anything fails after the event is created, the whole transaction is rolled back, so you would not see the event either.

---

## Why you can see Event but no races

The only way the DB can have the **Event row with correct metadata** (e.g. totalLaps 104, 8 drivers) and **zero races** is one of:

1. **Overview returned a non‑empty session list, but something after creating the event caused a rollback**  
   In that case the transaction would roll back and the event would not be committed. So this does **not** explain “event present, races missing” unless there is a separate bug (e.g. a second transaction or commit we didn’t find).

2. **Overview returned an empty session list (`sessions=[]`) while still having aggregate stats**  
   In the current parser, `total_laps` and `unique_drivers` are computed only from the session rows. So if `sessions` is empty, those stats are 0. We would then see `totalLaps: 0` in metadata, not 104. So this does **not** explain your case (metadata shows 104 laps, 8 drivers).

3. **Races were created and later deleted**  
   Possible if some other process or bug deletes by `event_id` or if there is a re‑ingest path that deletes races. No such path was found in the codebase.

4. **Different run created the event**  
   E.g. a first run created event + metadata (with 104, 8) and races; a second run (e.g. re‑import) saw `existing_event`, updated metadata, but the second overview had `sessions=[]`. Then we would only update metadata; we would **not** overwrite with zeros because the second run’s summary would have `total_laps=0` and we’d only set metadata from that run. So we’d end up with event + old metadata (104, 8) and still have the races from the first run—unless something else deleted them. So this only fits if races were deleted after a second run.

So the situation (event + correct metadata, zero races) is **not** explained by the normal “one ingest run” behaviour; it points to something like a partial commit we didn’t find, or races being removed after a successful run.

---

## What was added to help next time

- **Logging** in `ingest_practice_day` right after loading the overview:
  - `ingest_practice_day_overview_loaded`: logs `session_count`, `total_laps`, `unique_drivers`.
  - If `session_count == 0` but stats are non‑zero: `ingest_practice_day_overview_sessions_empty_but_stats_nonzero` (warning).

So on the next import you can check ingestion logs to see whether the overview had sessions or not.

---

## What you can do now

1. **Re‑run import** for the same practice day (same track + date).  
   - If it succeeds and you get 20 races and laps, the first run may have failed partway and we’re missing a code path that could leave “event but no races”; re‑ingest is idempotent so it’s safe.  
   - If it again creates only the event and no races, check ingestion logs for:
     - `ingest_practice_day_overview_loaded` → `session_count`.
     - `ingest_practice_day_overview_sessions_empty_but_stats_nonzero` (if it appears, the overview had stats but no session rows).

2. **Check ingestion service logs** for the **original** import (if still available) for:
   - `fetch_practice_day_overview_success` → `session_count`.
   - Any `ingest_practice_day_error` or exceptions after “overview loaded”.

3. **LiveRC page behaviour**  
   The practice session list is fetched with **HTTPX only** (no Playwright fallback). If that page is JS‑rendered, HTTPX might get HTML without the session table; the parser would then raise “No practice session table found” and the request would fail (no event). If you ever see “table not found” in logs for a page that works in the browser, consider adding a Playwright fallback for the practice day overview URL.

4. **Manual re‑ingest via API** (for debugging):

   ```bash
   # From host (replace track id and date as needed)
   curl -X POST http://localhost:3001/api/v1/practice-days/ingest \
     -H "Content-Type: application/json" \
   -d '{"track_id":"2aba913f-eb28-4b11-9f67-e9fdbdf52172","date":"2025-09-27"}' \
   --cookie "your-session-cookie"
   ```

   Then check the response (`sessions_ingested`, `laps_ingested`) and the ingestion service logs.

---

## Summary

- **Expected:** One import creates Event + all sessions (Races), drivers, results, and laps in one transaction.  
- **Observed:** Event and metadata (104 laps, 8 drivers) exist; races, entries, classes, and laps are zero.  
- **Likely:** Either (a) an exception after creating races led to rollback (then we’d expect no event—unless there’s another commit path), or (b) races were created and later removed, or (c) a bug/race we haven’t identified.  
- **Next steps:** Re‑import, check new logs (`session_count`, warnings), and inspect whether the overview is returning sessions; add Playwright fallback for the overview if the page is JS‑dependent.
