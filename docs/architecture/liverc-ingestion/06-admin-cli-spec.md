---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
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

The CLI provides the following top-level commands:

1. Tracks
   - list-tracks
   - refresh-tracks

2. Events
   - list-events
   - refresh-events
   - refresh-followed-events
   - ingest-event

3. Diagnostics
   - status
   - verify-integrity

These commands are described below.

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
- is_active
- is_followed
- last updated timestamp

Behaviour:

- Reads from database only.
- Does not call LiveRC.
- Never mutates data.

---

### 3.2 refresh-tracks

Description: Re-scrape the global LiveRC track list and update the Track table.

Arguments:

- none

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

- --depth (required) - Ingestion depth: `none` (metadata only) or `laps_full`
  (full ingestion)
- --ingest-new-only (optional) - Only ingest newly discovered events (default
  when depth is laps_full)
- --ingest-all (optional) - Ingest all events, including re-ingestion of
  existing events
- --quiet (optional) - Suppress per-track output, only show summary

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

### 4.4 ingest-event

Description: Perform ingestion for a specific event, including races, results,
and lap data.

Arguments:

- --event-id (required)
- --depth (optional, defaults to laps_full)

Behaviour:

- Validates event existence.
- If already fully ingested at this depth, exits with “already complete”.
- Otherwise:
  - Fetch race list
  - Fetch race result pages
  - Fetch lap data for each driver
  - Write to Race, RaceResult, RaceDriver, Lap tables
- Updates ingest_depth and last_ingested_at.
- Must be fully idempotent.

Exit codes:

- 0 success
- 1 validation error
- 2 ingestion failed
- 3 event already ingested at requested depth

---

## 5. Diagnostic Commands

### 5.1 status

Description: Show a summary of ingestion subsystem health.

Output includes:

- number of tracks
- number of events
- number of races
- oldest/ newest ingestion timestamps
- pending ingestion tasks (if any queued)

Behaviour:

- Pure DB read.
- No LiveRC calls.

---

### 5.2 verify-integrity

Description: Perform checks across data tables to flag:

- Orphaned races
- Orphaned race results
- Missing lap series
- Mismatched driver counts
- Events with partial ingestion

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

- refresh-tracks (nightly)
- refresh-followed-events (nightly, typically with `--depth none`)
- refresh-events (weekly or per-track)
- periodic ingestion for selected tracks (optional)

Rules:

- Cron MUST NOT run full ingestion for all events automatically.
- Only admin-marked followed tracks may be scheduled.
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
