---
created: 2026-06-02
author: Ingestion review pass (LLM-assisted)
status: findings only — no code changes made
verification:
  Findings cross-checked against LIVE liverc.com data on 2026-06-02 across two
  review passes. Pass 1 covered three real race-result pages; pass 2 added the
  live event page, entry list, multi-main result, and overall ranking pages (all
  canberraoffroad.liverc.com, event 486677). See "Verification log" below.
purpose:
  Deep bug review of the LiveRC ingestion service (connector, parsers, pipeline,
  validator, normalizer, repository, CLI/auto-ingest, metrics). Documents
  confirmed and suspected defects with evidence and suggested fixes.
scope:
  - ingestion/connectors/liverc/parsers/race_lap_parser.py
  - ingestion/connectors/liverc/parsers/race_results_parser.py
  - ingestion/connectors/liverc/connector.py
  - ingestion/ingestion/pipeline.py
  - ingestion/ingestion/validator.py
  - ingestion/ingestion/normalizer.py
  - ingestion/ingestion/recent_events.py
  - ingestion/ingestion/driver_matcher.py
  - ingestion/db/repository.py
  - ingestion/cli/commands.py
  - ingestion/common/metrics.py
relatedArchitecture:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
relatedRemediation:
  - docs/reviews/ingestion-advisory-lock-investigation-2026-06-02.md
  - docs/implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md
---

# Bug Review: LiveRC Ingestion Service

## Summary

The ingestion service is well structured (connector → parsers → normalizer →
validator → pipeline → repository) with broad fixture coverage. Across three
review passes the most durable findings are: a **red lap-parser test suite**
caused by non-representative fixtures (H2), an **operational** metrics
anti-pattern (H3), a confirmed **validator logic bug** (M1), a standings
**refresh gap** (M5), and a **false-positive integrity check** confirmed on the
live database (M6). Notably, the original headline "apostrophe drops a driver's
laps" finding (H1) was **disproven on live data** and downgraded to Low — see
the accuracy note.

**Second-pass focus (data trust).** A follow-up pass concentrated on the paths
that produce _user-facing standings and integrity signals_: the repository
upserts, driver matching, multi-main / qual-points / round-ranking / overall
ranking ingestion, and the `verify-integrity` checker. The standings parsers
themselves were verified working against live LiveRC pages, but the pass found a
**refresh gap** (standings are not re-ingested unless new races appear — M5), a
**false-positive integrity check** that perpetually reports "mismatched driver
counts" (M6), and a brittle exact-uppercase name join behind every standings
table (M7). None silently corrupt a stored value, but M5/M6 directly undermine
"can users trust what we show": standings can be stale/missing, and the
operator's own integrity report cries wolf.

**Important accuracy note (two corrections after live verification).** This
review's headline claim about laps was wrong twice and has been corrected
against **live data from liverc.com** both times:

1. **"Lap ingestion is broken in production."** _Withdrawn._ That was based on
   the committed fixtures; live LiveRC pages parse correctly (444 / 306 / 96
   laps across three real races). The fixtures simply don't match the live
   format — they use **unquoted keys + trailing commas**
   (`driverName: "FELIX KOEGLER", …`) while live emits **single-quoted** keys
   (`'driverName' : 'FELIX KOEGLER'`), so **6 of 9 `test_race_lap_parser.py`
   tests fail today** — a test-quality problem (H2), not a production one.
2. **"An apostrophe in a name silently drops that driver's lap series."**
   _Withdrawn / downgraded to Low (H1)._ A real apostrophe driver was traced end
   to end on live data (`MATTHEW O'LOUGHLIN`, race 6304825): **13 laps parsed
   and attached, name stored correctly.** LiveRC escapes the apostrophe
   (`O\'LOUGHLIN`), which the decoder survives. The earlier "reproduction" used
   a raw-unescaped apostrophe that is invalid JavaScript and that LiveRC cannot
   serve. The decoder is still fragile (it mangles the _internal_ name and
   truncates a fallback name→ID map), but those paths aren't exercised on live
   data — see H1.

The remaining decoder fragility (H1) is real but **latent/Low**; the parser
itself is the right thing to harden eventually, just not an active data-loss
source.

Severity legend: **Critical** (data loss now, broad) · **High** (confirmed data
loss with limited scope, or operational risk) · **Medium** (edge-case
correctness) · **Low** (cosmetic / latent).

Findings tied to live behaviour were validated against liverc.com; code-only
findings are logic issues independent of any specific page.

---

## High

### H1 — Apostrophe in a driver name: lap data is preserved on live data _(originally rated High; DOWNGRADED to Low after end-to-end live verification)_

**Effective severity: Low (latent edge case).** Two earlier revisions of this
entry over-stated this: first as a "critical / lap ingestion broken" issue, then
as a High "apostrophe silently drops that driver's entire lap series." **Both
framings are withdrawn — disproven on live data.** A real apostrophe-named
driver was traced end to end and his data is **correct**: see below.

**Live trace (Verification log, pass 3):** `MATTHEW O'LOUGHLIN`, event 486677,
race 6304825 (1/8 Electric Buggy B-Main).

- LiveRC escapes the apostrophe as a JS string escape:
  `'driverName' : 'MATTHEW O\'LOUGHLIN'` — **valid JavaScript** (it must be; the
  page renders lap charts from `racerLaps` in the browser).
- Results parser → `display_name = "MATTHEW O'LOUGHLIN"` (correct, from the HTML
  table cell), `source_driver_id = 768048` (the **real** LiveRC id, not
  synthetic).
- Lap parser → **13 laps parsed** for id 768048 (via both `parse_all_drivers`
  and single `parse()`), matching his `laps_completed = 13`. Laps attach to the
  result by `source_driver_id` (768048 == 768048). **No loss, correct name.**

**Why the earlier claim was wrong.** A 3-encoding decoder test (Verification
log, pass 3) shows the blanket `js_block.replace("'", '"')`:

- **raw apostrophe** `'O'BRIEN'` → laps dropped — _but this is invalid JS, so
  LiveRC cannot serve it_ (the earlier "reproduction" used this impossible
  shape);
- **JS-escaped** `'O\'BRIEN'` (what LiveRC actually emits) → `\'` becomes `\"`,
  still valid JSON → `json.loads` succeeds, **laps preserved**;
- **HTML entity** `'O&#39;BRIEN'` → also valid, **laps preserved**.

So for any encoding LiveRC can actually serve, laps are **not** lost.

**File:** `ingestion/connectors/liverc/parsers/race_lap_parser.py`
(`_extract_driver_laps_data` ~L137–156; `parse_all_drivers` ~L358–368;
`extract_racer_laps_extra_stats` ~L500–508)

**Residual (real but Low/latent) issues** — the decoder is still not robust, and
two apostrophe-specific corruptions exist, but the **primary path does not
depend on them**, which is why nothing breaks on live data:

- The lap parser's _internal_ `driverName` becomes `MATTHEW O"LOUGHLIN`
  (apostrophe → double-quote). Cosmetic only: laps are keyed by id, and the
  stored driver name comes from the results table, not this value.
- The results parser's name→ID _fallback_ map (`_extract_racer_laps_mapping`,
  regex `'driverName'\s*:\s*'([^']+)'`) truncates an apostrophe name at the
  escaped quote (→ `MATTHEW O\`). This map is used **only** when a results row
  lacks its own `data-driver-id`. If that fallback is ever exercised for an
  apostrophe driver, the truncated name would fail to match → synthetic id →
  laps would not attach. **Not observed live** (results rows carry real ids).

**Suggested fix (low priority).** Decode the `racerLaps[ID] = {…}` block with a
JS-aware parser instead of blanket quote replacement (e.g. `ast.literal_eval`/
`json5` on the single-quoted source so `\'` is honoured), and fix the
`_extract_racer_laps_mapping` regex to handle `\'`. This removes the cosmetic
name mangling and hardens the fallback path. It also helps H2 (a robust decoder
passes against more fixture shapes).

### H2 — Lap-parser fixtures are non-representative; `test_race_lap_parser.py` fails (red test suite)

**Files:** `ingestion/tests/fixtures/liverc/486677/race.630482{2,9}.html`,
`race.6304830.html`; `ingestion/tests/unit/test_race_lap_parser.py`

The committed fixtures store `racerLaps` with **unquoted keys and trailing
commas** (`driverName: "FELIX KOEGLER", … segments: [], }`). LiveRC does not
serve this shape (live is single-quoted — Verification log step 2), so the
fixtures appear to have been reformatted on capture (e.g. via a
prettifier/DOM-serializer) and no longer represent upstream.

The decoder (H1) can't read unquoted keys, so against these fixtures:

- `parse_all_drivers` returns **0 laps**, and
- `pytest test_race_lap_parser.py` → **6 failed, 3 passed** (Verification log
  step 4).

**Impact:** The lap-parser test module is red and provides no regression
protection for the very code paths most exposed to upstream format drift. It
also produced the false alarm corrected in the Summary.

**Suggested fix:** Re-capture the fixtures from a raw HTTPX fetch of a live
results page (single-quoted form) so tests exercise the real format, and/or add
a fixture variant per format the parser must support. Make the decoder robust
(H1) so it passes against both.

### H3 — Prometheus metrics use unbounded-cardinality label values

**File:** `ingestion/common/metrics.py`

Several metrics carry per-entity IDs as **label names**:

- `_INGESTION_DURATION` → `event_id`, `track_id` (L37–42)
- `_RACE_FETCH_DURATION` → `event_id`, `race_id` (L44–49)
- `_LAP_EXTRACTION_DURATION` → `event_id`, `race_id` (L51–56)
- `_INGESTION_LOCK_TIMEOUTS` → `event_id` (L79–84)
- `_EVENT_ENTRY_CACHE_HITS` / `_EVENT_ENTRY_CACHE_LOOKUPS` → `event_id`
  (L93–105), incremented per result row in `pipeline._batch_write_races_data`
  (L930–932).

Using high-cardinality UUIDs as label values is a known Prometheus anti-pattern:
each event/race creates a new time series, causing unbounded registry growth and
eventual memory pressure on the exporter. The cache counters are worst —
incremented once per result row.

**Suggested fix:** Drop the ID labels (aggregate by `track_id`/`result` only);
if per-event timing is needed, emit it via structured logs. See
`docs/architecture/liverc-ingestion/15-ingestion-observability.md`.

---

## Medium

### M1 — `Validator.validate_laps`: the "too many laps" guard is unreachable (indentation bug)

**File:** `ingestion/ingestion/validator.py` (~L448–491)

```python
if laps_completed > 10:
    if not laps or len(laps) == 0:
        raise ValidationError(...)
elif laps_completed > 0 and (not laps or len(laps) == 0):
    logger.warning("lap_data_missing_for_low_lap_count", ...)
    if len(laps) < laps_completed:
        logger.warning("lap_count_mismatch", ...)
    if len(laps) > laps_completed:          # <-- dead code
        raise ValidationError("Lap count mismatch: parsed {len(laps)} … completed")
```

The `len(laps) > laps_completed` check (and the `lap_count_mismatch` warning)
are nested inside the `elif` branch whose own condition requires
`len(laps) == 0`. Within that branch `len(laps)` is always `0`, so the
over-count guard can never fire and the warning is always redundant. The
intended protection against parsing _more_ laps than completed is effectively
disabled.

**Suggested fix:** De-indent the count-reconciliation checks so they run when
`laps` is non-empty.

### M2 — Non-numeric finishing position would drop the whole result row _(latent; live positions are numeric)_

**File:** `ingestion/connectors/liverc/parsers/race_results_parser.py`
(L290–294)

```python
try:
    position_final = int(position_elem.text().strip())
except (ValueError, AttributeError):
    logger.warning("result_row_invalid_position", url=url)
    continue   # whole row discarded
```

If LiveRC ever renders a non-numeric position (`DQ`, `DNS`, blank), the row is
dropped and that driver disappears from `race_results` — a plausible source of
the "non-contiguous finishing positions" symptom `verify-integrity` checks for
(CLI check #6). **Caveat:** the three live races inspected all show numeric
positions `1..N` (Verification log step 6), so this is currently latent, not
observed. Worth hardening defensively rather than urgently.

### M3 — Total race time only parses `MM:SS`, not `H:MM:SS` _(edge; unverified live)_

**Files:** `ingestion/ingestion/normalizer.py` `parse_total_time` (L236–255);
`race_results_parser.py` laps/time split (L383–388).

Both handle only two `:`-separated parts. A race ≥ 1 h (`"58/1:02:30.1"`) would
raise and silently set `total_time_seconds = None`. Note
`parse_race_duration_seconds` _does_ support `H:MM:SS` (L24–32), so the codebase
is internally inconsistent. No ≥1 h race was found live (these classes run ~30
min timed mains), so this is an edge case.

**Suggested fix:** Add the 3-part `H:MM:SS` case to `parse_total_time`
(mirroring `parse_lap_time`, L204–209) and the results parser's split.

### M4 — Recent-events candidate sort can raise `TypeError` on mixed `date`/`datetime`

**File:** `ingestion/ingestion/recent_events.py` (L133–136)

```python
candidates.sort(
    key=lambda e: _as_utc(e.event_date) if isinstance(e.event_date, datetime) else e.event_date,
    reverse=True,
)
```

If candidates ever mix tz-aware `datetime` (via `_as_utc`) and plain `date`,
sorting raises `TypeError`. In practice the CLI normalizes to `datetime` before
persistence, so this is latent — but the key is fragile.

**Suggested fix:** Normalize both branches to the same comparable type.

### M5 — Standings (multi-main, qual points, round rankings, overall final ranking) are not refreshed unless new races appear _(confirmed by control-flow)_

**File:** `ingestion/ingestion/pipeline.py` `_persist_event_data` (~L2111–2177)

On an incremental refresh the pipeline computes `races_to_process` = only the
_new_ `source_race_id`s (full set only when depth ≠ `LAPS_FULL` or `force`). The
multi-main and rankings ingestion blocks are nested **inside
`if races_to_process:`**:

```python
if races_to_process:
    races_ingested, results_ingested, laps_ingested = await self._process_races_parallel(...)
    # multi-main, qual points, round rankings, overall final ranking
    # ...all live here...
elif event.ingest_depth == IngestDepth.LAPS_FULL:
    logger.info("no_new_races_on_refresh", ...)   # <-- standings never touched
```

So when an already-complete event is refreshed and LiveRC has **changed a
standings page without adding a new race row** — e.g. an official correction to
the overall final ranking, a recomputed multi-main tie-break, or a late-posted
overall ranking — the refresh logs `no_new_races_on_refresh` and the standings
are **not re-fetched**. The headline "who won the event overall" data can stay
stale or missing until a `--force` re-ingest.

**Scope/caveat:** This self-heals in the common case, because standings updates
usually arrive _with_ new race rows (a new round/main), which makes
`races_to_process` non-empty and re-triggers the block. The genuine gap is
standings-only updates. The standings parsers were verified working on live data
(Verification log step 8), so this is a _freshness/completeness_ bug, not a
parsing bug.

**Suggested fix:** Move multi-main/rankings ingestion outside the
`if races_to_process:` guard (or run it whenever depth is `LAPS_FULL` on
refresh), so standings are reconciled on every refresh regardless of new races.

### M6 — `verify-integrity` driver-count check counts race-driver rows, not distinct drivers (perpetual false positives)

**File:** `ingestion/cli/commands.py` (~L1227–1241)

```python
driver_counts = session.query(
    Event.id,
    Event.event_drivers,
    func.count(func.distinct(RaceDriver.id)).label('actual_drivers')   # <-- RaceDriver.id
).outerjoin(Race, ...).outerjoin(RaceDriver, ...).group_by(...)
mismatched_drivers = [... if expected != actual]
```

`RaceDriver.id` is unique per `(race, driver)` row, so
`count(distinct(RaceDriver.id))` is the number of race-driver _rows_ in the
event — a driver who runs 6 sessions counts as 6. `Event.event_drivers` is the
unique-driver count LiveRC reports (e.g. **60** for event 486677, against **71**
entries and far more race-driver rows). The two will essentially **never** be
equal for any real multi-session event, so `verify-integrity` reports
"mismatched driver counts" for virtually every event.

**Impact:** The operator's own data-integrity tool is noisy enough to be
ignored, which is itself a trust hazard — real integrity problems hide in a wall
of false alarms.

**Confirmed on the live database (2026-06-02, `mre-postgres`, 3 events).**
Running the current query vs. a `distinct(driver_id)` version:

| Event     | `event_drivers` | current (`distinct RaceDriver.id`) | fixed (`distinct driver_id`) |
| --------- | --------------- | ---------------------------------- | ---------------------------- |
| 152528b7… | 56              | **597**                            | 56                           |
| 47c6ab39… | 128             | **792**                            | 128                          |
| 9a89f007… | 118             | **1678**                           | 121                          |

The current query flags **3/3 events (100%)** as mismatched (it is counting
race-driver _rows_, not drivers); the fixed query flags **1/3**, and that one is
off by only 3 (118 vs 121 — the legitimate entrants-vs-raced difference noted
below). This reproduces the false-positive behaviour on real data.

**Suggested fix:** Count distinct _drivers_:
`func.count(func.distinct( RaceDriver.driver_id))`, and decide whether the
intended comparison is against entries or against drivers-who-raced (they
legitimately differ when entrants DNS).

### M7 — Standings driver resolution uses an exact upper-case name join (silent drops) _(brittle; verified consistent for one event)_

**Files:** `ingestion/db/repository.py` `get_event_driver_name_to_id_map` /
`…_with_entries` (L1477–1509); `upsert_multi_main_result` (L1562–1573),
`upsert_event_qual_points`, `upsert_event_round_ranking`,
`upsert_event_overall_ranking`.

Every standings upsert resolves a driver by `driver_name.strip().upper()`
against a map keyed the same way. Unlike result/lap matching, this path does
**not** use `Normalizer.normalize_driver_name` (token sort, suffix/noise
stripping) or any fuzzy fallback. Any formatting difference between the
standings page and the race-results grid — extra whitespace, a `Jr`/`II` suffix,
an accent, a seed-number prefix — makes the entry fall through to
`..._driver_not_found` and it is **silently skipped** from the stored standings.

**Verified:** For event 486677 the live names matched exactly (multi-main 10/10,
overall 71/71 resolvable — Verification log step 8), so no drop was observed
here. The risk is latent but real across tracks/events with less consistent
naming.

**Suggested fix:** Resolve standings names through the same normalizer used for
results, and log a single aggregated count of unresolved standings rows per page
so silent drops become visible.

---

## Low

### L1 — Wrong metric stage label in `list_events_for_track`

`ingestion/connectors/liverc/connector.py` (L217): on HTTP failure while listing
events the connector records `self._record_error("fetch_race_page", err)`, but
the stage is `list_events_for_track`. Skews `connector_errors_total{stage}`.

### L2 — `refresh-recent-events --dry-run` still consumes the global cap

`ingestion/cli/commands.py` (L204–214, L880–881): dry-run increments
`stats["events_ingested"]` per simulated event, and the caller decrements the
global `ingests_remaining` by it. With many tracks and a finite `--max-ingests`,
a dry run can stop discovering eligible events earlier than a real run would,
under-reporting what _would_ be ingested.

### L3 — `fetch_race_page` forces Playwright whenever `racerLaps` is absent

`ingestion/connectors/liverc/connector.py` (L529):
`if html and ("racerLaps" not in html or "table" not in html.lower())` escalates
to Playwright. A legitimately not-yet-run race has no `racerLaps`, so every
refresh of such an event pays the Playwright cost. (Run races on live LiveRC do
contain `racerLaps`, so completed events are unaffected.)

### L4 — Synthetic driver IDs can collide within a race

`ingestion/connectors/liverc/parsers/race_results_parser.py` (L341–345): the
synthetic ID is `synthetic-{sha256(host|UPPER(display_name))}`. Two distinct
entrants with the same display name in one race would produce identical
`source_driver_id` → `Validator.validate_race_results` raises "Duplicate
source_driver_id" (`validator.py` L255–262). That check runs during the fetch
phase (`pipeline.py` L539, inside `_fetch_race_page_with_validation`), and
`_process_races_batch` gathers fetches with `return_exceptions=True` and **skips
only that one race** (L673–688) — the rest of the event still ingests. So the
practical effect is: **that single race silently disappears** from the event
(logged as `race_fetch_failed`), and the same name-only hash also conflates
genuinely different same-named drivers across events. Edge case; add the row /
finishing position to the hash input.

_(Correction note: an earlier revision of this entry claimed the duplicate would
reach `bulk_upsert_race_drivers` and abort the whole batch with a Postgres
`CardinalityViolation`. That is incorrect — validation rejects the race before
persistence, so the bulk insert is never reached with a duplicate key. Only the
single race is dropped.)_

### L5 — `verify-integrity` non-contiguous-position check false-positives on legitimate ties

`ingestion/cli/commands.py` (`verify-integrity` check #6, L1272–1307): flags a
race when `COUNT(DISTINCT position_final) < MAX(position_final)` (with
`min_pos == 1`). This **contradicts the validator's own model**:
`Validator.validate_race_results` explicitly _allows_ duplicate positions —
"Allow duplicate positions (ties are valid in racing)" (`validator.py`
L265–269). So a race with a legitimate tie (two drivers sharing a position)
stores duplicate `position_final` values, which makes distinct < max and trips
check #6 even though the data is correct and passed validation. Like M6, this
adds false noise to the integrity report. **Caveat:** no tie was observed in the
three live races inspected (positions were clean `1..N`), so this is latent, not
observed. Fix: detect _gaps_ in the position sequence rather than counting
distinct values, or treat shared positions as allowed (consistent with the
validator).

### L6 — Re-ingest is upsert-only; rows removed upstream are never deleted

`ingestion/db/repository.py` `bulk_upsert_race_results` / `bulk_upsert_laps`
(and the race-driver upsert) only insert/update. If LiveRC later removes a
finisher, renames a class, or re-runs a race with fewer drivers, the stale
`race_results`/`laps`/`race_drivers` rows from the prior ingest remain (only
`reingest-section-headers` deletes races explicitly). A normal `--force`
re-ingest will not reconcile deletions, leaving phantom finishers/laps. Edge,
but worth a per-race reconcile (delete rows whose `source_driver_id` is absent
from the latest fetch).

---

## Withdrawn / disproven after live verification

These appeared in the first draft and were **removed or downgraded** once live
data was checked:

- **"Lap extraction is broken in production / 0 laps ingested."** _Withdrawn._
  Live races parse fine (444 / 306 / 96 laps). The failure is fixture-only (now
  H2).
- **"`racerLaps` name→ID regex is dead against the current format."** _Withdrawn
  for production._ The single-quoted regex matches live data (12/12 mappings).
  It only fails on the non-representative fixtures.
- **"Lap-time parser can't handle `M:SS` laps."** _Disproven._ LiveRC stores lap
  times as decimal seconds even above 60 s (observed `'time' : '146.309'`; 0 of
  455 live lap-time values contained a colon). `racerLaps` never uses `M:SS` for
  the lap `time` field.
- **"An apostrophe in a driver name silently drops that driver's lap series."**
  _Withdrawn; downgraded to Low (H1)._ Traced end to end on live data
  (`MATTHEW O'LOUGHLIN`, race 6304825): 13 laps parsed and attached, name stored
  correctly, real `source_driver_id` 768048. LiveRC escapes the apostrophe
  (`O\'LOUGHLIN`), which the decoder survives; only a raw-unescaped apostrophe
  (invalid JS, never served) would drop laps. Residual decoder fragility remains
  Low — see H1.

---

## Suggested remediation order

1. **H2** — re-capture fixtures from raw live HTML and re-green
   `test_race_lap_parser.py` (the only currently-red suite).
2. **M6** — fix the `verify-integrity` driver-count query to count distinct
   `driver_id` (confirmed false-positive on the live DB; restores trust in the
   integrity tool).
3. **M5** — move standings ingestion outside the `if races_to_process:` guard so
   refreshes reconcile multi-main/rankings even with no new races.
4. **M1** — fix `validate_laps` indentation so the over-count guard runs.
5. **H3** — remove high-cardinality metric labels (before exposing a metrics
   endpoint).
6. **M7, M2–M4**, then **L1–L6** (defensive/cosmetic).
7. **H1** (now Low) — harden the lap-object decoder + name→ID regex. Low
   priority: no live data loss, but worth doing alongside H2 (a robust decoder
   is also more fixture-tolerant). Add a regression test with an apostrophe
   name.

---

## Verification log (liverc.com, 2026-06-02)

All checks run from the repo root against pure-Python parsing (the service
normally runs in Docker; these only exercise parsers).

1. **Live fetch.**
   `GET canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829` →
   HTTP 200, 159,889 bytes, 24 `racerLaps[…]` assignments.
2. **Live key style is single-quoted** on three real races (`id=6304829`,
   `6304830`, `6304822`): first key is `'driverName' : '...'`. Committed
   fixtures use unquoted `driverName: "..."` + trailing commas.
3. **Parser vs live data (works):**
   - `id=6304829` → 12 drivers, **444 laps**; driver 346997 → 47 laps; name→ID
     map = 12; results = 12, synthetic = 0.
   - `id=6304830` → 12 drivers, **306 laps**.
   - `id=6304822` → 10 drivers, **96 laps**.
4. **Parser vs committed fixtures (fails):** `parse_all_drivers` → 12 drivers,
   **0 laps** (`driver_laps_parse_error: malformed node … ast.Name`);
   `pytest tests/unit/test_race_lap_parser.py` → **6 failed, 3 passed**.
5. **Apostrophe (H1) — _synthetic_ repro, later SUPERSEDED:** a single-quoted
   block with a _raw, unescaped_ apostrophe `PATRICK O'BRIEN` →
   `unterminated string literal` → `{}` (laps dropped). **Caveat (added pass
   3):** that encoding is invalid JavaScript and is **not** what LiveRC serves —
   see pass-3 steps 16–17, which disprove the lap-loss claim on real data.
6. **Lap-time format (M3 disproven):** of 455 live lap `time` values, **0**
   contain a colon; max value `146.309` (decimal seconds). Positions (M2): live
   results first-column cells are numeric `'1'..'12'`.

### Pass 2 (standings + integrity paths), event 486677

7. **Live ancillary pages fetched:** `view_event` (HTTP 200, 29,017 B),
   `view_entry_list` (32,610 B), `event_overall_ranking` (39,656 B),
   `view_multi_main_result&id=939156` (20,483 B).
8. **Standings parsers work on live data:** event metadata →
   `Cormcc 2025 Rudi Wensing Memorial`, 71 entries / 60 drivers;
   `RaceListParser` → 32 races with `race_order` + `section_header`;
   `MultiMainListParser` → 3; `RankingsListParser` → 1 qual / 3 round / overall
   present; `EntryListParser` → 3 classes / 71 drivers;
   `OverallFinalRankingParser` → 71 entries; `MultiMainResultParser`(939156) →
   10 entries.
9. **Name-join check (M7):** all 10 multi-main names resolved against the
   race-driver name set by exact upper-case match (0 unmatched) for this event —
   brittle but consistent here.
10. **M5 confirmed by control-flow** (not data): multi-main/rankings ingestion
    is nested under `if races_to_process:` in `_persist_event_data` (pipeline
    L2116–2177), so a refresh with no new races skips them.

### Re-audit (correctness double-check of pass-2 findings)

11. **M1 re-verified:** `validator.py` L457–491 — the
    `len(laps) > laps_completed` guard (L484) sits inside the
    `elif … len(laps) == 0` branch, so it is dead code (0 > positive is never
    true). `validate_laps` is actually invoked on the live path (`pipeline.py`
    L763). Holds.
12. **M6 re-verified:** `commands.py` L1230 uses
    `count(distinct(RaceDriver.id))` (PK → row count), compared to
    `Event.event_drivers` (60 for 486677). Holds.
13. **L4 corrected:** `validate_race_results` (validator.py L255–262) raises on
    a duplicate `source_driver_id` during fetch (pipeline L539);
    `_process_races_batch` skips only that race (L673–688,
    `return_exceptions=True`). The earlier "aborts the whole batch via
    `CardinalityViolation`" claim was **withdrawn** — the bulk insert is never
    reached with a duplicate key.
14. **L5 refined:** the validator explicitly permits tied positions
    (validator.py L265–269), so `verify-integrity` check #6 contradicts it; no
    tie observed live (positions `1..N` in all three races), so latent.
15. **M6 reproduced on the live DB** (`mre-postgres`, 3 events): current query
    flags 3/3 (counts 597 / 792 / 1678 vs expected 56 / 128 / 118); fixed
    `distinct(driver_id)` query flags 1/3 (off by 3 on the one real difference).
    See M6 table.

### Pass 3 (H1 apostrophe — end-to-end live trace; corrects pass-1 claim)

16. **Real apostrophe driver located:** `MATTHEW O'LOUGHLIN` (event 486677, 1/8
    Electric Buggy B-Main, race **6304825**). Raw bytes show LiveRC escapes the
    apostrophe: `'driverName' : 'MATTHEW O\'LOUGHLIN'` (and
    `driverNames.push( 'MATTHEW O\'LOUGHLIN')`); the HTML results cell shows a
    raw `MATTHEW O'LOUGHLIN`.
17. **End-to-end trace on race 6304825 (laps preserved):**
    - `RaceLapParser.parse_all_drivers` and single `parse()` → **13 laps** for
      `racerLaps` id **768048** (his block).
    - `RaceResultsParser.parse` → `display_name = "MATTHEW O'LOUGHLIN"`
      (correct), `source_driver_id = "768048"` (real, **not** synthetic),
      `laps_completed = 13`.
    - Laps attach to the result by `source_driver_id` (768048 == 768048) →
      correct.
    - 3-encoding decoder test: raw `'O'BRIEN'` → laps dropped (but invalid JS);
      JS-escaped `'O\'BRIEN'` → laps kept, name → `O"BRIEN`; HTML-entity
      `'O&#39;BRIEN'` → laps kept. ⇒ for any encoding LiveRC can serve, **no lap
      loss**. H1 downgraded High → Low.

Command used (DB-grounded M6 check):

```bash
docker exec -i mre-liverc-ingestion-service python - <<'PY'
from sqlalchemy import func
from ingestion.db.session import db_session
from ingestion.db.models import Event, Race, RaceDriver
with db_session() as s:
    for label, col in (("current", RaceDriver.id), ("fixed", RaceDriver.driver_id)):
        rows = (s.query(Event.id, Event.event_drivers,
                        func.count(func.distinct(col)))
                 .outerjoin(Race, Race.event_id == Event.id)
                 .outerjoin(RaceDriver, RaceDriver.race_id == Race.id)
                 .group_by(Event.id, Event.event_drivers).all())
        print(label, sum(1 for _, exp, act in rows if exp != act), "/", len(rows), "mismatched")
PY
```

Commands used (representative):

```bash
curl -sS -A "Mozilla/5.0" \
  "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829" \
  -o /tmp/liverc_live.html

PYTHONPATH="$PWD" python - <<'PY'
from pathlib import Path
from ingestion.connectors.liverc.parsers.race_lap_parser import RaceLapParser
html = Path("/tmp/liverc_live.html").read_text()
a = RaceLapParser().parse_all_drivers(html, "x")
print(len(a), sum(len(v) for v in a.values()))
PY

# In-container test run (canonical):
docker exec -it mre-liverc-ingestion-service \
  python -m pytest tests/unit/test_race_lap_parser.py -q
```

## Appendix — File/line index

| ID  | File                                                               | Approx. lines             | Status                                                                  |
| --- | ------------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| H1  | `connectors/liverc/parsers/race_lap_parser.py`                     | 137–156, 358–368, 500–508 | **Downgraded High→Low**; lap-loss disproven on live data (race 6304825) |
| H2  | fixtures `486677/*.html`; `tests/unit/test_race_lap_parser.py`     | —                         | Confirmed (tests red)                                                   |
| H3  | `common/metrics.py`                                                | 37–105, 253–255           | Code review                                                             |
| M1  | `ingestion/validator.py`                                           | 448–491                   | Confirmed (logic)                                                       |
| M2  | `connectors/liverc/parsers/race_results_parser.py`                 | 290–294                   | Latent (live numeric)                                                   |
| M3  | `ingestion/normalizer.py`; `…/race_results_parser.py`              | 236–255; 383–388          | Edge (unverified)                                                       |
| M4  | `ingestion/recent_events.py`                                       | 133–136                   | Latent                                                                  |
| M5  | `ingestion/pipeline.py` `_persist_event_data`                      | 2111–2177                 | Confirmed (control-flow)                                                |
| M6  | `cli/commands.py` `verify-integrity`                               | 1227–1241                 | Confirmed (logic)                                                       |
| M7  | `db/repository.py` standings upserts                               | 1477–1509, 1562–1573      | Brittle (verified consistent for 1 event)                               |
| L1  | `connectors/liverc/connector.py`                                   | 217                       | Code review                                                             |
| L2  | `cli/commands.py`                                                  | 204–214, 880–881          | Code review                                                             |
| L3  | `connectors/liverc/connector.py`                                   | 529                       | Code review                                                             |
| L4  | `connectors/liverc/parsers/race_results_parser.py`; `validator.py` | 341–345; 255–262          | Edge (race skipped at validation)                                       |
| L5  | `cli/commands.py` `verify-integrity` #6                            | 1272–1307                 | Latent (validator allows ties)                                          |
| L6  | `db/repository.py` upserts                                         | 1385–1475, 2020+          | Edge                                                                    |
