---
created: 2026-05-31
creator: Jayson Brenton
lastModified: 2026-05-31
description:
  Operations runbook for the Recent Events Auto-Ingest scheduled job and CLI.
purpose:
  Step-by-step guidance for enabling, monitoring, troubleshooting, and manually
  testing automatic ingestion of recent LiveRC events. Complements
  docs/operations/liverc-operations-guide.md.
relatedFiles:
  - docs/architecture/liverc-ingestion/31-recent-events-auto-ingest.md
  - docs/implimentation_plans/recent-events-auto-ingest-2026-05.md
  - docs/adr/ADR-20260531-scheduled-recent-events-auto-ingest.md
  - docs/operations/liverc-operations-guide.md
  - docs/operations/environment-variables.md
  - ingestion/scripts/run-recent-events-auto-ingest.sh
  - ingestion/crontab
---

# Recent Events Auto-Ingest — operations runbook

**Feature status:** Implemented, **disabled by default**. The CLI command
(`ingest liverc refresh-recent-events`), the filter module
(`ingestion/ingestion/recent_events.py`), the cron wrapper
(`ingestion/scripts/run-recent-events-auto-ingest.sh`), and the 02:00 UTC
crontab entry all exist. The nightly job only runs when both
`MRE_SCRAPE_ENABLED=true` and `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=true`; the
latter defaults to `false`.

---

## 1. What this job does

Once per day (default **02:00 UTC**), the ingestion container:

1. Selects tracks by scope (default: **`is_followed=true` and
   `is_active=true`**).
2. For each track, fetches the LiveRC event list and upserts metadata into
   `events`.
3. For events whose date falls in the last **N days** (default **7**), runs
   **full ingestion** (`laps_full`) if eligible:
   - New to MRE, or still at `ingest_depth = none`
   - Event is at least **12 hours** old (default)
   - Under per-run and per-track caps

This is **separate** from the existing **00:30 UTC** job that only refreshes
metadata for followed tracks (`--depth none`).

---

## 2. Prerequisites

- Docker Desktop running; context `desktop-linux`.
- Containers up: `docker compose up -d`
- Ingestion service: `mre-liverc-ingestion-service`
- PostgreSQL reachable from ingestion container
- **`MRE_SCRAPE_ENABLED=true`** (global scrape kill switch)
- **`MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=true`** (feature-specific enable)

---

## 3. Environment variables

Set in `docker-compose.yml` for `liverc-ingestion-service` or `.env.docker`:

| Variable                                | Default    | Purpose                                                       |
| --------------------------------------- | ---------- | ------------------------------------------------------------- |
| `MRE_SCRAPE_ENABLED`                    | `true`     | Global kill switch — when `false`, all scrape cron jobs skip. |
| `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED` | `false`    | Feature gate — cron wrapper no-ops when `false`.              |
| `MRE_RECENT_EVENTS_DAYS`                | `7`        | Recency window passed to CLI as `--days`.                     |
| `MRE_RECENT_EVENTS_TRACKS`              | `followed` | Track scope: `followed`, `active`, or `all`.                  |
| `MRE_RECENT_EVENTS_MAX_INGESTS`         | `50`       | Max full ingests per run.                                     |
| `MRE_RECENT_EVENTS_MIN_AGE_HOURS`       | `12`       | Skip events newer than this.                                  |

After changing env vars:

```bash
docker compose restart liverc-ingestion-service
```

---

## 4. Cron schedule

| Job                    | UTC       | Script                             | Log file (in container)                  |
| ---------------------- | --------- | ---------------------------------- | ---------------------------------------- |
| Track sync             | 00:00     | `run-track-sync.sh`                | `/var/log/track-sync.log`                |
| Followed metadata      | 00:30     | `run-followed-event-sync.sh`       | `/var/log/event-refresh.log`             |
| **Recent auto-ingest** | **02:00** | `run-recent-events-auto-ingest.sh` | `/var/log/recent-events-auto-ingest.log` |

Each wrapper adds **0–120 s random jitter** before executing.

---

## 5. Manual execution

### 5.1 Full cron equivalent

```bash
docker exec -it mre-liverc-ingestion-service /usr/local/bin/run-recent-events-auto-ingest.sh
```

### 5.2 CLI directly (interactive)

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-recent-events \
  --days 7 \
  --tracks followed \
  --max-ingests 50 \
  --max-ingests-per-track 5 \
  --min-event-age-hours 12 \
  --quiet
```

### 5.3 Dry run (no pipeline ingest)

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-recent-events \
  --days 7 \
  --tracks followed \
  --dry-run
```

### 5.4 Conservative test (cap 1 ingest)

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-recent-events \
  --days 7 \
  --tracks followed \
  --max-ingests 1 \
  --max-ingests-per-track 1
```

---

## 6. Canonical test event (QA)

Use for manual verification after deploy or code changes:

### Primary — off-road, medium size

| Field                  | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| Track name             | Hot Rod Hobbies                                                  |
| Track slug             | `hotrodhobbies`                                                  |
| Event name             | Saturday Off-Road Club Racing                                    |
| Event date             | 2026-05-30                                                       |
| LiveRC source event ID | `506979`                                                         |
| URL                    | https://hotrodhobbies.liverc.com/results/?p=view_event&id=506979 |
| Entries / drivers      | 52 / 40                                                          |

**Preparation:**

1. Ensure track exists:
   `docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks | grep -i hotrod`
2. Mark track followed (if testing `followed` scope):

```sql
UPDATE tracks SET is_followed = true
WHERE source_track_slug = 'hotrodhobbies';
```

3. Run refresh with window covering May 30 and cap ≥ 1.

**Verification:**

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events \
  --track-id <TRACK_UUID> \
  --start-date 2026-05-24 \
  --end-date 2026-05-31
```

Expect row for source event `506979` with `Depth: laps_full`.

```sql
SELECT e.event_name, e.event_date, e.ingest_depth, e.last_ingested_at,
       (SELECT COUNT(*) FROM races r WHERE r.event_id = e.id) AS race_count,
       (SELECT COUNT(*) FROM laps l
        JOIN race_results rr ON rr.id = l.race_result_id
        JOIN races r ON r.id = rr.race_id
        WHERE r.event_id = e.id) AS lap_count
FROM events e
WHERE e.source = 'liverc' AND e.source_event_id = '506979';
```

### Alternate — smaller / faster (dirt oval)

| Field           | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| Track slug      | `metzrcraceway`                                                  |
| Event name      | Wednesday In & Out                                               |
| Event date      | 2026-05-27                                                       |
| Source event ID | `506631`                                                         |
| URL             | https://metzrcraceway.liverc.com/results/?p=view_event&id=506631 |

---

## 7. Monitoring

### 7.1 Log grep (structured JSON)

Inside container or aggregated logs:

```bash
docker exec mre-liverc-ingestion-service grep refresh_recent_events /var/log/recent-events-auto-ingest.log | tail -20
```

Key events:

- `refresh_recent_events_start`
- `refresh_recent_events_complete` — check `totals.events_ingested`,
  `totals.events_failed`, `duration_ms`
- `refresh_recent_events_event_skipped` — inspect `reason`

### 7.2 Health check questions

| Question                  | How to answer                                          |
| ------------------------- | ------------------------------------------------------ |
| Did cron run last night?  | `refresh_recent_events_complete` timestamp within 24 h |
| How many events ingested? | `totals.events_ingested` in complete log               |
| Why skipped?              | Count `events_skipped_*` fields in totals              |
| Stuck in progress?        | Search `event_ingestion_in_progress` warnings          |

### 7.3 Prometheus metrics

These counters/histogram are **recorded** by the command via
`ingestion/common/metrics.py` (into the in-process `metrics.REGISTRY`):

- `recent_events_auto_ingest_runs_total` (label `status`)
- `recent_events_auto_ingest_events_ingested_total`
- `recent_events_auto_ingest_events_failed_total`
- `recent_events_auto_ingest_duration_seconds`

**Note:** the ingestion service does **not** yet expose an HTTP `/metrics`
endpoint, so these values cannot be scraped by Prometheus today. Until a scrape
endpoint is added, rely on the structured logs in §7.1 for monitoring.

---

## 8. Troubleshooting

### 8.1 Job skipped entirely

**Symptom:** Log shows `recent events auto-ingest skipped`

| Message                                         | Cause                  | Action                                           |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------ |
| `MRE_SCRAPE_ENABLED != true`                    | Global scrape disabled | Set `MRE_SCRAPE_ENABLED=true`; restart container |
| `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED != true` | Feature not enabled    | Set to `true` when ready for production          |

### 8.2 Zero ingests but events in window

| Cause                           | Check                                     |
| ------------------------------- | ----------------------------------------- |
| Track not in scope              | `is_followed` / `is_active` flags         |
| Event already `laps_full`       | `ingest_depth` in DB                      |
| Min age filter                  | Event date is “today” and run is same day |
| Cap exhausted earlier in run    | `events_skipped_cap` in totals            |
| LiveRC list empty / parse error | `refresh_recent_events_track_error` logs  |

### 8.3 High failure rate

1. Check LiveRC availability (manual browser on track events page).
2. Inspect `event_ingestion_error` logs for parser vs HTTP errors.
3. Run single-event ingest:

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event \
  --event-id <UUID> --depth laps_full
```

4. If Playwright failures, see
   `docs/architecture/liverc-ingestion/10-connector-browser-strategy.md`.

### 8.4 Run exceeds 2 hours

- Lower `MRE_RECENT_EVENTS_MAX_INGESTS`.
- Confirm not using `--tracks active` unintentionally.
- Check for tracks requiring Playwright on every event list page.

### 8.5 Disable quickly (incident)

```bash
# In docker-compose or .env.docker
MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=false
# or full scrape stop:
MRE_SCRAPE_ENABLED=false

docker compose restart liverc-ingestion-service
```

Existing ingested data is unchanged.

---

## 9. Enabling in production (checklist)

- [x] Implementation complete and merged (CLI, filter module, cron wrapper, and
      crontab entry are present).
- [ ] Staging run with `--dry-run` reviewed.
- [ ] Staging run with `--max-ingests 3` succeeded; spot-check lap counts.
- [ ] `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=true` set in production env.
- [ ] Caps confirmed (`50` global, `5` per track default).
- [ ] On-call knows log path and §8 troubleshooting.
- [ ] Alert on missing `refresh_recent_events_complete` for 26 h (optional).

---

## 10. Comparison with related commands

| Command                                     | Scope               | Depth         | Date filter                       |
| ------------------------------------------- | ------------------- | ------------- | --------------------------------- |
| `refresh-followed-events --depth none`      | Followed            | Metadata only | None                              |
| `refresh-followed-events --depth laps_full` | Followed            | Full          | None (new events only by default) |
| `refresh-events --track-id X`               | One track           | Configurable  | None                              |
| **`refresh-recent-events`**                 | followed/active/all | Full          | **Last N days**                   |

---

## 11. Related documentation

- Architecture:
  [31-recent-events-auto-ingest.md](../architecture/liverc-ingestion/31-recent-events-auto-ingest.md)
- Implementation plan:
  [recent-events-auto-ingest-2026-05.md](../implimentation_plans/recent-events-auto-ingest-2026-05.md)
- General LiveRC ops: [liverc-operations-guide.md](./liverc-operations-guide.md)
- Web scraping policy:
  [27-web-scraping-best-practices.md](../architecture/liverc-ingestion/27-web-scraping-best-practices.md)
