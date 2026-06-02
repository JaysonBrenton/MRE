---
created: 2026-06-02
author: Ingestion review pass (LLM-assisted)
status: findings only — no code changes made
purpose:
  Deep bug review of the LiveRC ingestion service (connector, parsers, pipeline,
  validator, normalizer, CLI/auto-ingest, metrics). Documents confirmed and
  suspected defects with evidence and suggested fixes.
scope:
  - ingestion/connectors/liverc/parsers/race_lap_parser.py
  - ingestion/connectors/liverc/parsers/race_results_parser.py
  - ingestion/connectors/liverc/connector.py
  - ingestion/ingestion/pipeline.py
  - ingestion/ingestion/validator.py
  - ingestion/ingestion/normalizer.py
  - ingestion/ingestion/recent_events.py
  - ingestion/cli/commands.py
  - ingestion/common/metrics.py
relatedArchitecture:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
---

# Bug Review: LiveRC Ingestion Service

## Summary

The ingestion service is well structured (connector → parsers → normalizer →
validator → pipeline → repository), with broad unit/fixture coverage. However,
this pass found **one critical, reproduced, data-destroying defect** plus a
number of high/medium issues.

The headline problem: **lap-series extraction is completely broken against the
current LiveRC page format.** The committed fixtures already use LiveRC's
current `racerLaps[...]` JavaScript shape (unquoted object keys + trailing
commas), and the parser cannot decode it. As a result, **zero laps are ingested
for every race**, and **6 of 9 `test_race_lap_parser.py` unit tests currently
fail**. This breaks every downstream lap/pace feature (lap-by-lap trend charts,
pace consistency, derived-lap annotations) and makes `verify-integrity` flag
essentially every finisher as "missing lap data".

Severity legend: **Critical** (data loss / feature broken now) · **High**
(incorrect data or operational risk) · **Medium** (edge-case data loss /
correctness) · **Low** (cosmetic / minor).

All findings below were derived from reading the code; the Critical and the two
top High items were additionally **reproduced locally** against the repo
fixtures (commands in the Appendix).

---

## Critical

### C1 — Lap extraction fails on current LiveRC `racerLaps` format (no laps ingested)

**Files:** `ingestion/connectors/liverc/parsers/race_lap_parser.py`
(`_extract_driver_laps_data` ~L137–156, `parse_all_drivers` ~L358–368,
`extract_racer_laps_extra_stats` ~L500–508)

The parser locates the `racerLaps[ID] = { … }` block by brace-matching, then
tries to decode it as data with:

```python
js_block_clean = js_block.replace("'", '"')
try:
    driver_data = json.loads(js_block_clean)
except json.JSONDecodeError:
    import ast
    js_block_single = js_block.replace('"', "'")
    driver_data = ast.literal_eval(js_block_single)
```

The docstrings assume single-quoted JS keys (`'driverName':`). The **actual
LiveRC payload** in the committed fixtures looks like this
(`ingestion/tests/fixtures/liverc/486677/race.6304829.html`):

```js
racerLaps[152738] = {
    driverName: "LINDSAY FROST",
    fastLap: "38.061",
    laps: [
      { lapNum: "0", pos: "10", time: "0", pace: "0", segments: [], },
      { lapNum: "1", pos: "4", time: "44.564", pace: "27/20:03.228", segments: [], },
      ...
    ],
};
```

Note the **unquoted object keys** (`driverName:`, `lapNum:`) and the **trailing
commas**. Neither decoder can handle this:

- `json.loads` requires double-quoted keys →
  `JSONDecodeError: Expecting property name enclosed in double quotes`.
- `ast.literal_eval` treats unquoted `driverName` as a Python `Name` node →
  `ValueError: malformed node or string … <ast.Name object …>`.

Both paths fail, `_extract_driver_laps_data` returns `None`, and
`parse_all_drivers` logs `driver_laps_parse_error` for every driver and returns
an empty dict.

**Reproduced** (see Appendix A): running the real parser over the fixture yields
**0 total laps across all drivers**, and
`pytest tests/unit/test_race_lap_parser.py` reports **6 failed, 3 passed**.

**Impact:**

- No `laps` rows are written for any race in the current format. Lap-by-lap
  trend charts, pace/consistency analysis, and `derived_laps` annotations have
  no input.
- `verify-integrity` (CLI) will report nearly every result with
  `laps_completed > 0` as "missing/incomplete lap data".
- The failure is **silent at ingest time**: in `pipeline._process_race_cpu_sync`
  the lap path is wrapped in `except ValidationError: pass` (L785), and
  `parse_all_drivers` swallows the decode error per driver, so an event still
  completes as `laps_full` with results but no laps.

**Suggested fix:** Decode the block with a JS-object-aware parser instead of
naive quote-swapping. Options:

- Use `json5` (handles unquoted keys + trailing commas), or
- Pre-process the block: quote bare keys
  (`re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', block)`) and strip
  trailing commas (`re.sub(r',(\s*[}\]])', r'\1', block)`) before `json.loads`,
  taking care not to corrupt string values (e.g. names containing apostrophes —
  see C1b).

#### C1b — Naive quote-swap also corrupts names containing apostrophes

Even if keys were quoted, `js_block.replace("'", '"')` will break any value
containing an apostrophe (e.g. `"PATRICK O'BRIEN"` → `"PATRICK O"BRIEN"`),
producing invalid JSON and again dropping that driver's laps. The fallback
`replace('"', "'")` has the symmetric problem. The chosen fix for C1 must parse
the JS object **structurally** rather than by global character replacement.

---

## High

### H1 — `racerLaps` name→ID mapping regex is dead against the current format

**File:** `ingestion/connectors/liverc/parsers/race_results_parser.py`
(`_extract_racer_laps_mapping`, ~L203)

```python
pattern = r'racerLaps\[(\d+)\]\s*=\s*\{[^}]*\'driverName\'\s*:\s*\'([^\']+)\''
```

This expects single-quoted `'driverName' : '...'`. The current payload uses an
**unquoted key with a double-quoted value** (`driverName: "FELIX KOEGLER"`), so
the regex matches nothing. **Reproduced:** the mapping returns **0 entries** for
the fixture.

**Impact:** The results parser's secondary driver-ID strategy (match by name to
`racerLaps` keys, L321–326) never fires. When a row lacks a `data-driver-id`
attribute, the parser falls through to a **synthetic** ID (L328–355) instead of
the real LiveRC driver ID. That weakens cross-race/cross-event driver identity
and inflates synthetic-ID usage. (In the sample fixture the visible rows still
carry `data-driver-id`, so results themselves parse; the regression is in the
fallback path and is masked until LiveRC omits the attribute.)

**Suggested fix:** Update the regex to accept optional quotes around the key and
either quote style around the value, e.g.
`racerLaps\[(\d+)\]\s*=\s*\{[^}]*?["']?driverName["']?\s*:\s*["']([^"']+)["']`.

### H2 — `Validator.validate_laps`: the "too many laps" check is unreachable (indentation bug)

**File:** `ingestion/ingestion/validator.py` (~L448–491)

```python
if laps_completed > 10:
    if not laps or len(laps) == 0:
        raise ValidationError(... )
elif laps_completed > 0 and (not laps or len(laps) == 0):
    logger.warning("lap_data_missing_for_low_lap_count", ...)
    if len(laps) < laps_completed:
        logger.warning("lap_count_mismatch", ...)
    if len(laps) > laps_completed:          # <-- dead code
        raise ValidationError("Lap count mismatch: parsed {len(laps)} … completed")
```

The `len(laps) > laps_completed` validation (and the `lap_count_mismatch`
warning) are nested **inside the `elif` whose own condition requires
`len(laps) == 0`**. Within that branch `len(laps)` is always `0`, so:

- `len(laps) < laps_completed` is always true (redundant warning), and
- `len(laps) > laps_completed` is never true (**the over-count guard can never
  raise**).

**Impact:** The intended protection against parsing _more_ laps than a driver
completed is effectively disabled. The check should run whenever laps are
present (i.e. de-indented to top level, applied to the non-empty case).

**Suggested fix:** Move the count-reconciliation checks out of the empty-list
branch so they evaluate when `laps` is non-empty.

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

Using high-cardinality UUIDs as label values is a well-known Prometheus
anti-pattern: every event/race/driver creates a new time series. Over time this
causes **unbounded memory growth** in the registry/scraper and can OOM the
exporter. The cache-hit counters are particularly bad because they fire once per
result row.

**Suggested fix:** Drop `event_id`/`race_id` labels (or aggregate by `track_id`
/ `result` only). If per-event timing is needed, emit it via structured logs,
not metric labels. See
`docs/architecture/liverc-ingestion/15-ingestion-observability.md`.

---

## Medium

### M1 — Non-numeric finishing position drops the entire result row

**File:** `ingestion/connectors/liverc/parsers/race_results_parser.py`
(L290–294)

```python
try:
    position_final = int(position_elem.text().strip())
except (ValueError, AttributeError):
    logger.warning("result_row_invalid_position", url=url)
    continue   # <-- whole row discarded
```

If LiveRC renders a non-numeric position cell (e.g. `DQ`, `DNS`, `DNF`, or a
blank for a disqualified entry), the row is skipped entirely and that driver
disappears from `race_results`. This is a plausible cause of the "non-contiguous
finishing positions" symptom that `verify-integrity` explicitly checks for (CLI
`verify-integrity`, check #6).

**Suggested fix:** When the position cell is non-numeric, still ingest the row
with a sentinel/last position (or a dedicated status field) rather than dropping
it, so standings remain complete.

### M2 — Total race time only parses `MM:SS`, not `H:MM:SS`

**Files:** `ingestion/ingestion/normalizer.py` `parse_total_time` (L236–255);
`ingestion/connectors/liverc/parsers/race_results_parser.py` (L383–388).

Both only handle two `:`-separated parts. A race ≥ 1 hour (`"58/1:02:30.1"`)
takes the 3-part branch and raises, so `total_time_seconds` is silently set to
`None`. Note `parse_race_duration_seconds` _does_ support `H:MM:SS` (L24–32) —
so the codebase is internally inconsistent about long sessions.

**Suggested fix:** Add the `H:MM:SS` case to `parse_total_time` (mirror the
3-part handling in `parse_lap_time`, L204–209) and to the results parser's
laps/time split.

### M3 — Lap time decoding uses raw `float()` and cannot handle `M:SS` laps

**File:** `ingestion/connectors/liverc/parsers/race_lap_parser.py` (L245, L402)

```python
lap_time_seconds = float(time_str)   # "1:23.456" -> ValueError -> 0.0
```

`Normalizer.parse_lap_time` exists specifically to convert `M:SS.mmm`/`H:MM:SS`
lap strings to seconds, but it is **not used** for lap-series parsing. A lap
encoded as `"1:23.456"` (long/marshalled laps do exceed 60 s) becomes `0.0`,
which then fails `Validator.validate_lap` (`lap_time_seconds > 0`), and because
`_process_race_cpu_sync` swallows `ValidationError` (L785) the **entire driver's
lap list is dropped**. (Confidence: medium — depends on whether the `time` field
ever uses the colon form; the sample fixtures use decimal seconds, but the
dedicated normalizer routine strongly implies the colon form occurs.)

**Suggested fix:** Use `Normalizer.parse_lap_time(time_str)` in the lap parser
instead of bare `float()`.

### M4 — Candidate sort can raise `TypeError` on mixed `date`/`datetime`

**File:** `ingestion/ingestion/recent_events.py` (L133–136)

```python
candidates.sort(
    key=lambda e: _as_utc(e.event_date) if isinstance(e.event_date, datetime) else e.event_date,
    reverse=True,
)
```

If the candidate list ever mixes `datetime` (made tz-aware by `_as_utc`) and
plain `date` event dates, Python raises
`TypeError: can't compare offset-aware datetime to datetime.date`, aborting that
track's auto-ingest. In practice the CLI normalizes to `datetime` before
persistence, so this is latent — but it is a fragile key that will fail the
moment a `date` slips through.

**Suggested fix:** Normalize both branches to a comparable type, e.g. coerce to
a tz-aware `datetime` (`_as_utc(datetime.combine(d, time.min))`).

---

## Low

### L1 — Wrong metric stage label in `list_events_for_track`

**File:** `ingestion/connectors/liverc/connector.py` (L217) On HTTP failure
while listing events, the connector records
`self._record_error("fetch_race_page", err)` — but the stage is
`list_events_for_track`. This skews the `connector_errors_total{stage=…}` metric
and misleads debugging.

### L2 — `refresh-recent-events --dry-run` still consumes the global cap

**File:** `ingestion/cli/commands.py` (L204–214, L880–881) In dry-run,
`_refresh_events_for_track` increments `stats["events_ingested"]` for each
simulated event (L213), and the caller decrements the global `ingests_remaining`
by that count (L881). With many tracks and a finite `--max-ingests`, a dry run
can stop "discovering" eligible events earlier than a real run would,
under-reporting what _would_ be ingested.

**Suggested fix:** Do not decrement the global cap for dry-run iterations (or
track dry-run counts separately).

### L3 — `fetch_race_page` forces Playwright whenever `racerLaps` is absent

**File:** `ingestion/connectors/liverc/connector.py` (L529)
`if html and ("racerLaps" not in html or "table" not in html.lower())` escalates
to Playwright. A legitimately not-yet-run race has no `racerLaps`, so every
refresh of such an event pays the Playwright cost unnecessarily.

### L4 — Synthetic driver IDs can collide within a race

**File:** `ingestion/connectors/liverc/parsers/race_results_parser.py`
(L341–345) The synthetic ID is `synthetic-{sha256(host|UPPER(display_name))}`.
Two distinct entrants sharing a display name in the same race would produce
identical `source_driver_id`, tripping `Validator.validate_race_results`
"Duplicate source_driver_id" → the whole race is rejected. The same key also
conflates genuinely different drivers of the same name across events. Edge case,
but worth adding the row index / position to the hash input.

---

## Process / quality observations

- **Test suite is currently red.**
  `ingestion/tests/unit/test_race_lap_parser.py` fails 6/9 against the committed
  fixtures (see C1). Either CI is not gating on this module or the fixtures were
  updated to the new LiveRC format without updating the parser. Re-greening this
  file is the fastest way to validate the C1 fix.
- The combination of **swallowed lap errors** (`except ValidationError: pass`,
  pipeline L785) and **per-driver `try/except` in the parsers** means lap-data
  loss is invisible in normal logs except as scattered `warning` lines. Consider
  surfacing an aggregate "laps_expected vs laps_written" count per event and
  failing/flagging when the ratio collapses (which C1 would have caught
  immediately).

---

## Suggested remediation order

1. **C1 / C1b** — fix `racerLaps` decoding (structural JS-object parse).
   Re-green `test_race_lap_parser.py`. _(Restores all lap features.)_
2. **H1** — fix the `racerLaps` name→ID regex (restores driver-ID fallback).
3. **H2** — fix `validate_laps` indentation so the over-count guard runs.
4. **H3** — remove high-cardinality metric labels.
5. **M1–M4**, then **L1–L4**.

---

## Appendix A — Reproduction

Run from the repo root (the ingestion service normally runs in Docker; these
commands only exercise pure-Python parsing for verification):

```bash
# 1) Lap decoding yields zero laps on the committed fixture
PYTHONPATH="$PWD" python - <<'PY'
from pathlib import Path
from ingestion.connectors.liverc.parsers.race_lap_parser import RaceLapParser
html = Path("ingestion/tests/fixtures/liverc/486677/race.6304829.html").read_text()
url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
alld = RaceLapParser().parse_all_drivers(html, url)
print("drivers:", len(alld), "total laps:", sum(len(v) for v in alld.values()))
PY

# 2) Unit tests for the lap parser
docker exec -it mre-liverc-ingestion-service \
  python -m pytest ingestion/tests/unit/test_race_lap_parser.py -q
```

Observed during this review:

- `parse_all_drivers` → `drivers: 12  total laps: 0` (every driver logs
  `driver_laps_parse_error: malformed node or string … <ast.Name …>`).
- `_extract_racer_laps_mapping` → `0` entries (H1).
- `pytest` → **6 failed, 3 passed**.

## Appendix B — File/line index of findings

| ID       | File                                                  | Approx. lines             |
| -------- | ----------------------------------------------------- | ------------------------- |
| C1 / C1b | `connectors/liverc/parsers/race_lap_parser.py`        | 137–156, 358–368, 500–508 |
| H1       | `connectors/liverc/parsers/race_results_parser.py`    | 203                       |
| H2       | `ingestion/validator.py`                              | 448–491                   |
| H3       | `common/metrics.py`                                   | 37–105, 253–255           |
| M1       | `connectors/liverc/parsers/race_results_parser.py`    | 290–294                   |
| M2       | `ingestion/normalizer.py`; `…/race_results_parser.py` | 236–255; 383–388          |
| M3       | `connectors/liverc/parsers/race_lap_parser.py`        | 245, 402                  |
| M4       | `ingestion/recent_events.py`                          | 133–136                   |
| L1       | `connectors/liverc/connector.py`                      | 217                       |
| L2       | `cli/commands.py`                                     | 204–214, 880–881          |
| L3       | `connectors/liverc/connector.py`                      | 529                       |
| L4       | `connectors/liverc/parsers/race_results_parser.py`    | 341–345                   |
