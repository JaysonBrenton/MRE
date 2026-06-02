---
created: 2026-05-31
owner: Platform / Ingestion
lastModified: 2026-05-31
purpose:
  Phased implementation plan for scheduled discovery and automatic full
  ingestion of recent LiveRC events, as specified in
  docs/architecture/liverc-ingestion/31-recent-events-auto-ingest.md.
relatedDocs:
  - docs/architecture/liverc-ingestion/31-recent-events-auto-ingest.md
  - docs/operations/recent-events-auto-ingest-runbook.md
  - docs/adr/ADR-20260531-scheduled-recent-events-auto-ingest.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/06-admin-cli-spec.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - docs/AGENTS.md
---

# Recent Events Auto-Ingest — implementation plan (May 2026)

This plan implements
[31-recent-events-auto-ingest.md](../architecture/liverc-ingestion/31-recent-events-auto-ingest.md).
All runtime verification is **Docker-only** per [AGENTS.md](../AGENTS.md).

**Status:** Planned — documentation only; no production code in this commit
unless otherwise noted in git history.

---

## Phase 0 — Decisions (lock before coding)

- [ ] **Track scope for production cron:** Confirm **`followed`** as default
      (recommended). Document sign-off in architecture doc §3.1.
- [ ] **Window length:** Confirm **7 days** default; env override acceptable.
- [ ] **Min event age:** Confirm **12 hours** default (skip same-day in-progress
      events).
- [ ] **Caps:** Confirm **`max-ingests=50`**, **`max-ingests-per-track=5`** for
      production.
- [ ] **Cron time:** Confirm **02:00 UTC** after track sync (00:00) and followed
      metadata refresh (00:30).
- [ ] **Keep or replace followed `--depth none` cron:** **Keep** — metadata-only
      refresh remains cheap and useful for search UX.

---

## Phase 1 — Domain logic and unit tests

**Goal:** Pure Python functions for date-window and eligibility filtering, with
no LiveRC I/O.

### 1.1 New module

Create `ingestion/ingestion/recent_events.py` (or
`ingestion/services/recent_events_filter.py` — match nearest existing pattern):

```python
@dataclass
class RecentEventsFilterConfig:
    days: int
    min_event_age_hours: int
    run_at_utc: datetime

def event_overlaps_window(
    event_date: date,
    event_date_end: date | None,
    config: RecentEventsFilterConfig,
) -> bool: ...

def event_meets_min_age(
    event_date: date,
    config: RecentEventsFilterConfig,
) -> bool: ...

def is_eligible_for_auto_ingest(
    *,
    ingest_depth: IngestDepth,
    is_new_this_run: bool,
    re_ingest_stale: bool,
    overlaps_window: bool,
    meets_min_age: bool,
) -> bool: ...
```

**Rules:** Implement exactly §3.2–3.4 of architecture doc.

### 1.2 Unit tests

File: `ingestion/tests/unit/test_recent_events_filter.py`

| Test case               | Input                                                    | Expected            |
| ----------------------- | -------------------------------------------------------- | ------------------- |
| Window inclusive 7 days | run=2026-05-31, days=7, event=2026-05-24                 | overlap=True        |
| Outside window          | event=2026-05-23                                         | overlap=False       |
| Future event            | event=2026-06-01                                         | overlap=False       |
| Multi-day overlap       | start=2026-05-22, end=2026-05-25, window from 2026-05-24 | overlap=True        |
| Min age                 | event=today, min_age=12h, run=morning same day           | meets_min_age=False |
| Eligible new            | new, none depth, in window, min age ok                   | eligible=True       |
| Skip complete           | laps_full, re_ingest_stale=False                         | eligible=False      |
| Stale re-ingest flag    | laps_full, re_ingest_stale=True                          | eligible=True       |

**Acceptance:**
`docker exec mre-liverc-ingestion-service pytest ingestion/tests/unit/test_recent_events_filter.py -q`
passes.

---

## Phase 2 — CLI command `refresh-recent-events`

**Goal:** New Click command reusing pipeline + connector, with track scope
query.

### 2.1 Track query helper

```python
def _load_tracks_for_scope(session, scope: str) -> list[Track]:
    if scope == "followed":
        return session.query(Track).filter(
            Track.is_active.is_(True),
            Track.is_followed.is_(True),
        ).order_by(Track.track_name, Track.id).all()
    if scope == "active":
        return session.query(Track).filter(
            Track.is_active.is_(True),
        ).order_by(Track.track_name, Track.id).all()
    ...
```

### 2.2 Extend or refactor `_refresh_events_for_track`

Option A (preferred): add optional parameters:

```python
def _refresh_events_for_track(
    ...,
    ingest_filter: Callable[[Event, bool], bool] | None = None,
    max_ingests_remaining: Callable[[], int] | None = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
```

When `ingest_filter` is set, only pass matching event IDs to the `laps_full`
loop.

Option B: new function `_refresh_recent_events_for_track` that duplicates upsert
then filtered ingest — faster to ship but duplicates logic; avoid unless
time-constrained.

### 2.3 Command implementation sketch

```python
@liverc.command("refresh-recent-events")
@click.option("--days", default=7, show_default=True)
@click.option("--tracks", type=click.Choice(["followed", "active", "all"]), default="followed")
@click.option("--min-event-age-hours", default=12, show_default=True)
@click.option("--max-ingests", default=50, show_default=True)
@click.option("--max-ingests-per-track", default=5, show_default=True)
@click.option("--re-ingest-stale", is_flag=True, default=False)
@click.option("--dry-run", is_flag=True, default=False)
@click.option("--quiet", is_flag=True, default=False)
def refresh_recent_events(...):
    _ensure_scraping_enabled("refresh-recent-events")
    ...
```

**Global ingest counter:** Decrement `--max-ingests` across tracks; stop
ingesting when 0.

**Per-track counter:** Reset at each track; stop track ingests when per-track
cap hit.

### 2.4 Stats dict extensions

Add to returned totals:

```python
"events_in_window": 0,
"events_eligible": 0,
"events_skipped_cap": 0,
"events_skipped_in_progress": 0,
"events_skipped_age": 0,
"events_skipped_already_full": 0,
```

### 2.5 Acceptance criteria

- [ ] Command registered under `ingest liverc` namespace.
- [ ] `--dry-run` performs LiveRC list fetch + upsert OR skips upsert (choose
      one and document — recommend: **fetch + upsert, skip pipeline**).
- [ ] `--quiet` suppresses per-event lines.
- [ ] Exit code 0 on partial event failures.
- [ ] Respects `MRE_SCRAPE_ENABLED=false` via `_ensure_scraping_enabled`.

### 2.6 Manual smoke test (Docker)

Use canonical fixture from architecture doc §10:

```bash
# Ensure Hot Rod Hobbies is followed in DB (or use refresh-tracks + admin follow)

docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks | grep -i hotrod

# Dry run
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-recent-events \
  --days 7 --tracks followed --dry-run

# Single real ingest (cap 1)
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-recent-events \
  --days 7 --tracks followed --max-ingests 1 --max-ingests-per-track 1
```

Verify in DB:

```sql
SELECT id, event_name, event_date, ingest_depth, last_ingested_at
FROM events
WHERE source_event_id = '506979';
```

Expect `ingest_depth = laps_full` and non-null `last_ingested_at`.

---

## Phase 3 — Cron automation

**Goal:** Nightly unattended run with kill switches.

### 3.1 Shell wrapper

Create `ingestion/scripts/run-recent-events-auto-ingest.sh`:

```bash
#!/bin/bash
set -e
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
[ -f /app/.env.cron ] && . /app/.env.cron

if [ "${MRE_SCRAPE_ENABLED:-true}" != "true" ]; then
  echo "recent events auto-ingest skipped (MRE_SCRAPE_ENABLED != true)"
  exit 0
fi

if [ "${MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED:-false}" != "true" ]; then
  echo "recent events auto-ingest skipped (MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED != true)"
  exit 0
fi

sleep $((RANDOM % 120))
export PYTHONPATH=/app
cd /app

DAYS="${MRE_RECENT_EVENTS_DAYS:-7}"
TRACKS="${MRE_RECENT_EVENTS_TRACKS:-followed}"
MAX="${MRE_RECENT_EVENTS_MAX_INGESTS:-50}"
MIN_AGE="${MRE_RECENT_EVENTS_MIN_AGE_HOURS:-12}"

python3 -m ingestion.cli ingest liverc refresh-recent-events \
  --days "$DAYS" \
  --tracks "$TRACKS" \
  --max-ingests "$MAX" \
  --min-event-age-hours "$MIN_AGE" \
  --quiet
```

### 3.2 Crontab entry

Append to `ingestion/crontab`:

```cron
# Recent Events Auto-Ingest
# Runs daily at 02:00 UTC (after track sync + followed metadata refresh)
0 2 * * * /usr/local/bin/run-recent-events-auto-ingest.sh >> /var/log/recent-events-auto-ingest.log 2>&1
```

### 3.3 Docker image

Ensure wrapper is copied and executable in ingestion Dockerfile (mirror existing
`run-followed-event-sync.sh` install step).

Update `ingestion/scripts/cron-entrypoint.sh` to export new env vars into
`.env.cron`.

### 3.4 Acceptance

- [ ] With `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=false`, wrapper exits 0 and
      logs skip message.
- [ ] With enabled=true in dev, manual invocation of wrapper completes.
- [ ] Log file path documented in runbook.

---

## Phase 4 — Observability and ops docs

**Goal:** Operators can answer “did last night’s job work?”

### 4.1 Metrics

In `ingestion/common/metrics.py`, add counters listed in architecture §8.1.

Increment in CLI command on complete / per failure.

### 4.2 Update existing docs

| Document                                                                 | Update                                    | Status                 |
| ------------------------------------------------------------------------ | ----------------------------------------- | ---------------------- |
| `docs/architecture/liverc-ingestion/06-admin-cli-spec.md`                | Add §4.4 `refresh-recent-events`          | Done (planned section) |
| `docs/operations/liverc-operations-guide.md`                             | Link to runbook; note new cron            | Done                   |
| `docs/operations/environment-variables.md`                               | Add MRE*SCRAPE + MRE_RECENT_EVENTS*\*     | Done                   |
| `docs/AGENTS.md`                                                         | Mention third cron job in ops bullet      | Done                   |
| `docs/architecture/liverc-ingestion/01-overview.md`                      | Policy nuance for scheduled recent ingest | Done                   |
| `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`    | §9.1 test matrix                          | Done                   |
| `docs/architecture/liverc-ingestion/15-ingestion-observability.md`       | §9 metrics/logs                           | Done                   |
| `docs/architecture/liverc-ingestion/21-ingestion-recovery-procedures.md` | §15 incident containment                  | Done                   |
| `docs/adr/ADR-20260531-scheduled-recent-events-auto-ingest.md`           | ADR for policy change                     | Done                   |
| `docs/README.md`, `docs/implimentation_plans/README.md`                  | Index links                               | Done                   |

### 4.3 Acceptance

- [ ] Runbook complete (see
      `docs/operations/recent-events-auto-ingest-runbook.md`).
- [ ] At least one log query example for structured logs.

---

## Phase 5 — Integration tests (optional but recommended)

**Goal:** Regression safety for filter + command wiring.

1. **Fixture HTML:** Reuse existing `ingestion/tests/fixtures/liverc/` event
   list pages; no new LiveRC fetch in CI.
2. **Test:** Mock connector `list_events_for_track` to return summaries with
   dates inside/outside window; assert ingest pipeline `ingest_event` call
   count.

File: `ingestion/tests/integration/test_refresh_recent_events_cli.py`

**Acceptance:** CI green; no network access required.

---

## Phase 6 — Future enhancements (out of scope v1)

Document only — do not implement unless requested:

| Enhancement                                         | Notes                                                     |
| --------------------------------------------------- | --------------------------------------------------------- |
| `--since-date` / `--until-date` on `refresh-events` | Share filter module.                                      |
| Admin HTTP job trigger                              | Mirror `POST /tracks/sync` pattern.                       |
| Per-track `last_event_scan_at`                      | Avoid full list fetch when unchanged (LiveRC lacks ETag). |
| Parallel track discovery                            | Pool with max concurrency 3; careful with crawl-delay.    |
| User notification                                   | Email when followed track gets new ingested event.        |
| `active` scope production                           | Requires capacity review §6 of architecture doc.          |

---

## Definition of done (feature complete)

- [ ] Architecture doc §4 CLI matches implemented flags.
- [ ] Unit tests for filter logic.
- [ ] Manual E2E on Hot Rod Hobbies `506979` succeeds in Docker.
- [ ] Cron wrapper + crontab + env vars wired.
- [ ] Runbook reviewed by ops.
- [ ] `06-admin-cli-spec.md` updated.
- [ ] No regression in existing `refresh-followed-events --depth none` cron.

---

## Estimated effort

| Phase                  | Effort            |
| ---------------------- | ----------------- |
| 0 Decisions            | 0.5 h (review)    |
| 1 Filter + tests       | 4–6 h             |
| 2 CLI                  | 6–8 h             |
| 3 Cron                 | 2 h               |
| 4 Observability + docs | 3–4 h             |
| 5 Integration tests    | 4 h (optional)    |
| **Total**              | **~2–3 dev days** |

---

## Risk register

| Risk                                  | Mitigation                                          |
| ------------------------------------- | --------------------------------------------------- |
| LiveRC rate limiting / blocking       | Default `followed` scope; caps; jitter; kill switch |
| Ingest in-progress events             | `--min-event-age-hours`                             |
| Long-running cron overlaps next night | Single-flight lock file or job duration alert       |
| Playwright-heavy tracks slow run      | Per-run cap; metrics on duration                    |
| DB growth                             | Caps; only recent window; monitor lap table size    |
