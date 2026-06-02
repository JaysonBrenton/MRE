---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-05-31
description: Admin CLI specification for LiveRC ingestion management
purpose:
  Defines command-line tools for administrators to manage LiveRC ingestion,
  verify catalogue consistency, and run scheduled ingestion jobs. These tools
  operate entirely on the backend and provide the authoritative operational
  interface for ingestion control outside the UI.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 06. Admin CLI Specification (LiveRC Ingestion Subsystem)

This document defines the command-line tools that administrators use to manage
LiveRC ingestion, verify catalogue consistency, and run scheduled ingestion jobs
via cron. These tools operate entirely on the backend, outside the UI, and
represent the authoritative operational interface for ingestion control.

The CLI MUST:

- Run locally on the MRE server (developer machine, production server, or
  container).
- **Primary execution method: Docker container** - Commands should be executed
  via `docker exec` into the running `mre-liverc-ingestion-service` container.
- Use the same ingestion pipeline logic that the HTTP API uses.
- Produce deterministic output suitable for logs, automation, and cron.
- Never require frontend components.
- Never depend on LiveRC unless ingestion is explicitly triggered.

The CLI MUST NOT:

- Execute partial ingestion unless explicitly requested.
- Modify event or track metadata outside ingestion flow.
- Return HTML or raw LiveRC content.

---

## 1. Command Namespace

All tools belong to one namespace:

mre ingest …

This ensures clarity when future connectors are added (e.g., mre ingest liverc,
mre ingest another_source).

For V1, all commands fall under:

mre ingest liverc …

## 1.1 Execution Method

**Primary Method: Docker Execution**

All CLI commands MUST be executed inside the Docker container using:

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc <command> [options]
```

**Prerequisites:**

- Ingestion service container must be running:
  `docker compose up -d liverc-ingestion-service`
- Docker network configured (see `docs/operations/docker-user-guide.md`)

**Why Docker?**

- No local Python setup required (Python 3.11, dependencies, Playwright
  pre-installed)
- Pre-configured database connection via Docker network
- Consistent environment across developers and environments
- No virtual environment management needed

**Alternative: Local Execution**

Local execution is supported but requires:

- Python 3.11+ installation
- Virtual environment setup
- Dependency installation (`pip install -r requirements.txt`)
- Playwright browser installation (`playwright install chromium`)
- Manual environment variable configuration

See `docs/operations/liverc-operations-guide.md` for complete execution
instructions.

---

## 2. CLI Commands Overview

Authoritative implementation: `ingestion/cli/commands.py` (Click). Namespace:
`python -m ingestion.cli ingest liverc …` plus top-level
`python -m ingestion.cli auto-confirm-links` and
`python -m ingestion.cli drivers deduplicate`.

The CLI provides at least the following `liverc` subcommands:

1. Tracks
   - `list-tracks`
   - `refresh-tracks` (optional metadata refresh)
   - `backfill-track-countries`

2. Events
   - `list-events`
   - `refresh-events`
   - `refresh-followed-events`
   - `refresh-recent-events` (implemented — see §4.4)
   - `ingest-event`
   - `reingest-section-headers`

3. Diagnostics
   - `status`
   - `verify-integrity`

4. Other entrypoints (not under `liverc`)
   - `auto-confirm-links` — batch-confirm user–driver links where appropriate
   - `drivers deduplicate` — driver deduplication maintenance

Detailed behaviour for each command remains in the sections below where
documented; use the source file for flags and options not yet expanded here.

---

## 3. Track Commands

### 3.1 list-tracks

Description: List all tracks currently stored in the Track catalogue.

Arguments:

- none

Output includes:

- track_id
- source_track_slug
- track_name
- is_active (LiveRC catalogue membership; see
  [04-data-model § Track flags](./04-data-model.md#track-catalogue-flags-and-follow-model))
- is_followed (global admin ingestion scope; not per-user favourites)
- last updated timestamp

Behaviour:

- Reads from database only.
- Does not call LiveRC.
- Never mutates data.

---

### 3.2 refresh-tracks

Description: Re-scrape the global LiveRC track list and update the Track table
via the shared `TrackSyncService`.

Arguments:

- `--metadata` / `--no-metadata` (optional, default `--metadata`) — Enable or
  disable per-track dashboard metadata enrichment.

Behaviour:

- Calls LiveRC track index page.
- Inserts new tracks.
- Updates last_updated field.
- Never deletes tracks automatically (deletion requires manual intervention).
- Must be idempotent.

Cron usage:

- Recommended nightly.

---

## 4. Event Commands

### 4.1 list-events

Description: List events for a given track, optionally filtered by dates.

Arguments:

- --track-id (required)
- --start-date (optional)
- --end-date (optional)

Behaviour:

- Reads from Event table.
- Does not call LiveRC.
- Useful for validating catalogue before ingestion.

---

### 4.2 refresh-events

Description: Populate or refresh events for a specific track.

Arguments:

- --track-id (required)
- --depth (required) - Ingestion depth: `none` (metadata only) or `laps_full`
  (full ingestion)
- --ingest-new-only (optional) - Only ingest newly discovered events (default
  when depth is laps_full)
- --ingest-all (optional) - Ingest all events, including re-ingestion of
  existing events

Behaviour:

- Calls LiveRC events page for that track.
- Extracts:
  - event_name
  - event_date
  - entries
  - drivers
  - event URL
- Updates existing events or inserts new ones.
- If `--depth laps_full` is specified, triggers full ingestion for events (new
  only by default, or all if `--ingest-all` is specified).
- Must be idempotent.

Cron usage:

- Optional weekly job for followed tracks.

---

### 4.3 refresh-followed-events

Description: Refresh events for all tracks marked as `is_followed=true`. This
command iterates through all followed tracks and refreshes their events.

Arguments:

- --depth (optional, default `none`) - Ingestion depth: `none` (metadata only)
  or `laps_full` (full ingestion)
- --ingest-new-only (optional) - Only ingest newly discovered events (default
  when depth is laps_full)
- --ingest-all (optional) - Ingest all events, including re-ingestion of
  existing events
- --quiet (optional) - Suppress per-event output, only show summary

Behaviour:

- Queries database for all tracks where `is_followed=true`.
- For each followed track, calls `refresh-events` with the specified depth and
  ingestion options.
- Aggregates results across all tracks.
- Must be idempotent.

Cron usage:

- Recommended nightly job to keep followed tracks up to date.
- Typically run with `--depth none` to update metadata without full ingestion.

---

### 4.4 refresh-recent-events

**Status:** Implemented in `ingestion/cli/commands.py` (filter logic in
`ingestion/ingestion/recent_events.py`). Feature-gated for cron by
`MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED` (default `false`). Normative spec:
[31-recent-events-auto-ingest.md](31-recent-events-auto-ingest.md). ADR:
[ADR-20260531](../adr/ADR-20260531-scheduled-recent-events-auto-ingest.md).

Description: Discover events on a track scope, upsert metadata, and
automatically run **`laps_full`** ingestion for events whose dates fall within a
recency window (default **7 days**). Intended for nightly cron after track sync
and followed metadata refresh.

Arguments:

- --days (optional, default `7`) — Recency window in calendar days.
- --tracks (optional, default `followed`) — `followed` | `active` | `all`.
- --min-event-age-hours (optional, default `12`) — Skip events newer than this.
- --max-ingests (optional, default `50`) — Max full ingests per run (`0` =
  unlimited, dev only).
- --max-ingests-per-track (optional, default `5`) — Per-track cap per run.
- --re-ingest-stale (optional flag) — Re-ingest events already at `laps_full`
  (admin only; not used by cron).
- --dry-run (optional flag) — Log eligible events; skip pipeline ingest.
- --quiet (optional flag) — Summary output only.

Behaviour:

- Queries tracks by `--tracks` scope (`followed` = `is_active AND is_followed`).
- For each track: fetch LiveRC event list, upsert summaries (same as
  `refresh-events`).
- For events overlapping the date window and passing eligibility (§3.4 of doc
  31): call pipeline at `laps_full`.
- Process tracks in stable order; within track ingest `event_date DESC`.
- Failure on one track or event must not abort the full run.
- Must respect `MRE_SCRAPE_ENABLED` via `_ensure_scraping_enabled`.
- Must be idempotent.

Cron usage:

- Nightly via `run-recent-events-auto-ingest.sh` at **02:00 UTC** (active entry
  in `ingestion/crontab`).
- Requires `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=true` in addition to global
  scrape enable; the wrapper exits early (no HTTP) when either flag is unset.
- Env defaults: see
  [environment-variables.md](../../operations/environment-variables.md).

Operations:
[recent-events-auto-ingest-runbook.md](../../operations/recent-events-auto-ingest-runbook.md).

---

### 4.5 ingest-event

Description: Perform ingestion for a specific event, including races, results,
and lap data.

Arguments:

- --event-id (required)
- --depth (optional, defaults to laps_full)
- --force (optional flag) - Re-process all races (e.g. to repair `race_order`)
  even if the event is already at the requested depth

Behaviour:

- Validates event existence.
- Pipeline skips work already complete unless `--force` is passed.
- Otherwise:
  - Fetch race list
  - Fetch race result pages
  - Fetch lap data for each driver
  - Write to Race, RaceResult, RaceDriver, Lap tables
- Updates ingest_depth and last_ingested_at.
- Must be fully idempotent.

Exit codes:

- 0 success
- 2 ingestion failed (any error)

---

## 5. Diagnostic Commands

### 5.1 status

Description: Show a summary of ingestion subsystem health.

Output includes:

- number of tracks
- number of events
- number of races
- number of results
- number of laps
- oldest / newest ingestion timestamps
- events grouped by `ingest_depth`

Behaviour:

- Pure DB read.
- No LiveRC calls.

---

### 5.2 verify-integrity

Description: Perform checks across data tables to flag:

- Orphaned races
- Orphaned race results
- Missing / incomplete lap series
- Mismatched driver counts
- Events marked fully ingested but missing races
- Races with non-contiguous finishing positions (e.g. missing P2)

Exits non-zero (1) when any issue is found, 0 when clean.

Behaviour:

- Pure DB read.
- No LiveRC calls.

---

## 6. Logging Requirements

All CLI commands MUST:

- Emit machine-readable, timestamped logs.
- Use structured fields (logfmt or JSON).
- Never print raw HTML.
- Print errors in a single diagnostic block.

Examples of required metadata:

- timestamp
- command
- arguments
- track_id / event_id (if applicable)
- ingest_depth
- duration_ms
- status

---

## 7. Cron Integration

Administrators may use cron for:

- refresh-tracks (nightly, 00:00 UTC)
- refresh-followed-events (nightly, 00:30 UTC, typically with `--depth none`)
- refresh-recent-events (nightly, 02:00 UTC; gated by
  `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED` — see doc 31)
- refresh-events (weekly or per-track, manual ops)
- periodic ingestion for selected tracks (optional)

Rules:

- Cron MUST NOT run unbounded full ingestion across the entire catalogue.
  **`refresh-recent-events`** is the approved exception when:
  - `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=true`,
  - track scope defaults to **`followed`**,
  - date window, min-age, and per-run caps are enforced (doc 31).
- Only admin-marked followed tracks are in scope for v1 production cron.
- The ingestion pipeline MUST remain idempotent to avoid data corruption.

---

## 8. Future-Proofing

The CLI namespace “mre ingest liverc” allows:

- Adding additional connectors later (e.g., elapsed-time sources, MyLaps, custom
  telemetry)
- Maintaining separate ingestion pipelines and schemas per connector
- Ensuring consistent operational patterns across connectors

The CLI MUST NOT require redesign when new connectors are added.

---

End of 06-admin-cli-spec.md.
