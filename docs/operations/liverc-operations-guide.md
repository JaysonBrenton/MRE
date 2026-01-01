# LiveRC Operations Guide

**Document Purpose**: Complete guide for executing and running all LiveRC-related features, including how to retrieve required IDs from the database.

**Last Updated**: 2025-01-27

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [CLI Commands](#cli-commands)
3. [API Endpoints](#api-endpoints)
4. [Retrieving IDs from Database](#retrieving-ids-from-database)
5. [Complete Workflows](#complete-workflows)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference](#quick-reference)

---

## Prerequisites

### Recommended: Docker Setup (Primary Method)

**For containerized deployments, Docker execution is the recommended and primary method for running CLI commands.** This approach:

- **No local Python setup required** - Python 3.11, dependencies, and Playwright are pre-installed in the container
- **Consistent environment** - Same Python version and dependencies for all developers
- **Pre-configured database connection** - Database URL and network connectivity already configured
- **No virtual environment management** - Avoids Python version conflicts and dependency issues
- **Ready to use** - Just ensure the ingestion service container is running

**Prerequisites for Docker execution:**
1. Docker and Docker Compose installed
2. Ingestion service container running: `docker-compose up -d liverc-ingestion-service`
3. Docker network configured (see `docs/operations/docker-user-guide.md`)

**All examples in this guide show Docker execution first, followed by local execution alternatives.**

### Alternative: Local Python Setup (Optional)

If you prefer to run CLI commands locally without Docker:

1. **Python Environment** (for CLI and API):
   ```bash
   cd ingestion/
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   playwright install chromium
   ```

2. **Environment Variables**:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/mre"
   export LOG_LEVEL="INFO"
   ```

3. **Node.js Environment** (for TypeScript scripts):
   ```bash
   npm install
   npx prisma generate
   ```

### Database Connection

**For Docker execution:** Database connection is automatically configured via Docker network. The container connects to `mre-postgres` using the connection string from `.env.docker`.

**For local execution:** Ensure your `DATABASE_URL` environment variable is set correctly and points to your PostgreSQL database.

### Scraping Kill Switch

Operations can pause all LiveRC scraping (cron + manual CLI + admin UI) by setting the shared env flag:

```bash
export MRE_SCRAPE_ENABLED=false
```

When disabled:

- Cron wrappers (`run-track-sync.sh`, `run-followed-event-sync.sh`) log a skip message and exit before any HTTP calls.
- CLI commands (`refresh-tracks`, `refresh-events`, `refresh-followed-events`, `ingest-event`) fail fast with a helpful error.
- Next.js clients surface the same message before hitting the ingestion API.

Re-enable scraping with `MRE_SCRAPE_ENABLED=true`. This flag is part of `policies/site_policy/policy.json` so Python and TypeScript stay in sync.

---

## CLI Commands

### Execution Methods

CLI commands can be executed in two ways:

1. **Docker Execution** (Recommended - Primary Method):
   - Execute via `docker exec` into the running `mre-liverc-ingestion-service` container
   - **No local Python setup required** - Python, dependencies, and Playwright are pre-installed
   - **Pre-configured environment** - Database connection and environment variables already set
   - **Consistent across developers** - Same environment for everyone
   - Ensure the service is running: `docker-compose up -d liverc-ingestion-service` (or `./dc up -d liverc-ingestion-service`)

2. **Local Execution** (Alternative - Requires Python Setup):
   - Execute from the `ingestion/` directory with the Python virtual environment activated
   - Requires local Python 3.11+ installation and dependency management
   - Requires manual environment variable configuration
   - Requires Playwright browser installation

### Command Structure

**Docker Execution** (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc <command> [options]
```

**Local Execution** (Alternative):
```bash
python -m ingestion.cli ingest liverc <command> [options]
```

**Note:** The `-it` flags enable interactive terminal mode with proper output formatting. All examples in this guide show Docker execution first.

### Available Commands

#### 1. List Tracks

**Command**: `list-tracks`

**Description**: Lists all tracks currently in the database.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc list-tracks
```

**Output Format**:
```
Found X tracks:
  <track_id> | <source_track_slug> | <track_name> | Active: <true/false> | Followed: <true/false>
```

**Example Output**:
```
Found 150 tracks:
  a1b2c3d4-e5f6-7890-abcd-ef1234567890 | canberraoffroad | Canberra Off Road Model Car Club | Active: True | Followed: False
  b2c3d4e5-f6a7-8901-bcde-f12345678901 | sydneyrc | Sydney RC Racing | Active: True | Followed: True
```

**Use Case**: Use this command to find track IDs needed for other operations.

---

#### 2. Refresh Tracks

**Command**: `refresh-tracks`

**Description**: Re-scrapes the global LiveRC track catalogue and updates the database. Adds new tracks, updates existing ones, and marks tracks that no longer exist on LiveRC as inactive.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc refresh-tracks
```

**Output**:
```
Track refresh completed:
  Added: 5
  Updated: 145
  Deactivated: 2
  Total: 150
```

**Use Case**: Run this periodically to keep your track catalogue synchronized with LiveRC.

**Automated Execution**: A cron job runs this command automatically every 24 hours at midnight UTC. Reports are generated in the `docs/reports/` directory. See "Track Sync Cron Job and Reports" section below for details.

**Note**: This command does not require any IDs.

#### Automated Event Refresh for Followed Tracks

Followed tracks are refreshed nightly via `run-followed-event-sync.sh`, which executes the `refresh-followed-events` CLI command with `--depth none`. This keeps event metadata up to date without manual CLI runs. You can run the same workflow locally:

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-followed-events --depth none
```

For ad-hoc deep ingests across all followed tracks, pass `--depth laps_full` (optionally `--quiet` to suppress per-event output). The command automatically iterates every `Track` marked `is_followed=true` and aggregates the ingestion results.

**Scheduling courtesy:** both cron wrappers add a small random jitter (0-120 seconds) before firing to avoid hammering LiveRC right at the top of the minute. Leave this in place when copying scripts into other schedulers.

---

#### 3. List Events

**Command**: `list-events`

**Description**: Lists all events for a specific track, optionally filtered by date range.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <track_id> [--start-date <ISO_DATE>] [--end-date <ISO_DATE>]
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc list-events --track-id <track_id> [--start-date <ISO_DATE>] [--end-date <ISO_DATE>]
```

**Required Parameters**:
- `--track-id`: Track UUID (get from `list-tracks` command)

**Optional Parameters**:
- `--start-date`: Start date in ISO format (YYYY-MM-DD), e.g., `2025-01-01`
- `--end-date`: End date in ISO format (YYYY-MM-DD), e.g., `2025-12-31`

**ISO Date Format**: Dates must be in ISO 8601 format: `YYYY-MM-DD` (e.g., `2025-01-15`, `2024-12-31`). Do not include time components.

**Example** (Docker):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Example with Date Range** (Docker):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events \
  --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --start-date 2025-01-01 \
  --end-date 2025-12-31
```

**Output Format**:
```
Found X events:
  <event_id> | <source_event_id> | <event_name> | <event_date> | Depth: <ingest_depth>
```

**Example Output**:
```
Found 12 events:
  c3d4e5f6-a7b8-9012-cdef-123456789012 | 486677 | 2024 Nationals | 2024-10-15 00:00:00 | Depth: laps_full
  d4e5f6a7-b8c9-0123-def0-234567890123 | 489123 | 2024 Club Championship | 2024-11-20 00:00:00 | Depth: none
```

**Use Case**: Use this command to find event IDs needed for ingestion operations.

---

#### 4. Refresh Events

**Command**: `refresh-events`

**Description**: Populates or refreshes the event list for a specific track by fetching from LiveRC.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <track_id> --depth {none|laps_full} [--ingest-new-only|--ingest-all]
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc refresh-events --track-id <track_id> --depth {none|laps_full} [--ingest-new-only|--ingest-all]
```

**Required Parameters**:
- `--track-id`: Track UUID (get from `list-tracks` command)
- `--depth`: Ingestion depth - `none` (metadata only) or `laps_full` (full ingestion)

**Optional Parameters**:
- `--ingest-new-only`: Only ingest newly discovered events (default when `--depth laps_full`)
- `--ingest-all`: Ingest all events for the track, including re-ingestion of existing events

**Examples** (Docker):

1. **Metadata only** (discover events, no race data):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 --depth none
```

2. **Full ingestion for new events only** (default behavior):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 --depth laps_full --ingest-new-only
```

3. **Full ingestion for all events** (re-ingest existing events):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 --depth laps_full --ingest-all
```

**Output** (with `--depth none`):
```
Event refresh completed:
  Events discovered: 3 new, 9 updated
  Total events: 12
```

**Output** (with `--depth laps_full`):
```
Event refresh completed:
  Events discovered: 3 new, 9 updated
  Total events: 12

Full ingestion results:
  Events ingested: 3 successful, 0 failed
  Races ingested: 45
  Results ingested: 320
  Laps ingested: 12450
```

**Use Case**: 
- Use `--depth none` to discover events without ingesting race data
- Use `--depth laps_full --ingest-new-only` to discover and fully ingest new events in one command
- Use `--depth laps_full --ingest-all` to re-ingest all events for a track

**Note**: This command requires a track ID. Use `list-tracks` to find it. The unified command eliminates the need to run separate `refresh-events` and `ingest-event` commands.

---

#### 5. Ingest Event

**Command**: `ingest-event`

**Description**: Performs full data ingestion for a specific event, including races, results, and lap data.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <event_id> [--depth <depth>]
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc ingest-event --event-id <event_id> [--depth <depth>]
```

**Required Parameters**:
- `--event-id`: Event UUID (get from `list-events` command)

**Optional Parameters**:
- `--depth`: Ingestion depth (default: `laps_full`)
  - `none`: Event metadata only (for discovery/browsing)
  - `laps_full`: Full ingestion including races, results, and lap data

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The `none` depth is used for event discovery, but users always get complete data when importing.

**Example** (Docker):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id c3d4e5f6-a7b8-9012-cdef-123456789012
```

**Example with Custom Depth** (Docker):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event \
  --event-id c3d4e5f6-a7b8-9012-cdef-123456789012 \
  --depth laps_full
```

**Output**:
```
Ingesting event c3d4e5f6-a7b8-9012-cdef-123456789012 with depth laps_full...
Ingestion completed successfully:
  Races ingested: 15
  Results ingested: 180
  Laps ingested: 8460
```

**Use Case**: Use this command to ingest race data for a specific event after refreshing events.

**Note**: This command requires an event ID. Use `list-events` to find it.

---

#### 6. Refresh Followed Events

**Command**: `refresh-followed-events`

**Description**: Refreshes events for all tracks marked as `is_followed=true`. This command automatically iterates through all followed tracks and refreshes their events. Useful for keeping event metadata up to date for tracks of interest.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-followed-events --depth {none|laps_full} [--quiet]
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc refresh-followed-events --depth {none|laps_full} [--quiet]
```

**Required Parameters**:
- `--depth`: Ingestion depth - `none` (metadata only) or `laps_full` (full ingestion)

**Optional Parameters**:
- `--quiet`: Suppress per-event output (useful for bulk operations)

**Examples** (Docker):

1. **Metadata only** (discover events, no race data):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-followed-events --depth none
```

2. **Full ingestion for all followed tracks**:
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-followed-events --depth laps_full
```

3. **Full ingestion with quiet mode**:
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-followed-events --depth laps_full --quiet
```

**Output** (with `--depth none`):
```
Refreshing events for 12 followed tracks...
Track: Canberra Off Road Model Car Club
  Events discovered: 2 new, 5 updated
Track: Sydney RC Racing
  Events discovered: 1 new, 3 updated
...
Refresh completed:
  Tracks processed: 12
  Events discovered: 15 new, 45 updated
  Total events: 180
```

**Output** (with `--depth laps_full`):
```
Refreshing events for 12 followed tracks...
Track: Canberra Off Road Model Car Club
  Events discovered: 2 new, 5 updated
  Full ingestion results:
    Events ingested: 2 successful, 0 failed
    Races ingested: 24
    Results ingested: 180
    Laps ingested: 7200
...
Refresh completed:
  Tracks processed: 12
  Events discovered: 15 new, 45 updated
  Events ingested: 15 successful, 0 failed
  Total races ingested: 180
  Total results ingested: 1350
  Total laps ingested: 54000
```

**Use Case**: 
- Use `--depth none` for regular maintenance to keep event metadata up to date
- Use `--depth laps_full` to perform full ingestion across all followed tracks
- Automated cron job runs this command nightly with `--depth none` (see "Automated Event Refresh for Followed Tracks" section below)

**Automated Execution**: A cron job runs this command automatically every night at midnight UTC via `run-followed-event-sync.sh` with `--depth none`. This keeps event metadata synchronized for all followed tracks without manual intervention.

**Note**: This command does not require any IDs - it automatically processes all tracks where `is_followed=true`.

---

#### 7. Status

**Command**: `status`

**Description**: Shows ingestion subsystem health summary with counts of tracks, events, races, results, and laps.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc status
```

**Output**:
```
Ingestion Status:
  Tracks: 150
  Events: 1245
  Races: 5678
  Results: 67890
  Laps: 1234567
  Oldest Ingestion: 2024-01-15T10:30:00
  Newest Ingestion: 2025-01-27T14:22:00

Events by Ingestion Depth:
  none: 800
  laps_full: 245
```

**Use Case**: Use this command to get a quick overview of your ingestion system's state.

---

#### 7. Verify Integrity

**Command**: `verify-integrity`

**Description**: Verifies data integrity across tables, checking for orphaned records, missing lap data, and other inconsistencies.

**Usage**:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc verify-integrity
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc verify-integrity
```

**Output** (if issues found):
```
Found 5 orphaned races:
  Race abc123... (event_id: def456...)
  ...

Found 3 results with missing/incomplete lap data:
  Result xyz789...: expected 47 laps, found 45
  ...

Integrity check completed with issues found.
```

**Output** (if no issues):
```
Integrity check completed - no issues found.
```

**Exit Codes**:
- `0`: No issues found
- `1`: Issues found

**Use Case**: Run this periodically to ensure data integrity, especially after bulk ingestion operations.

---

## API Endpoints

The ingestion service exposes a FastAPI REST API. Start the API server first:

```bash
cd ingestion/
python -m ingestion.main
```

Or using uvicorn directly:
```bash
uvicorn ingestion.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000` (or your configured host/port).

### Base URL

All endpoints are prefixed with `/api/v1/`.

### Available Endpoints

#### 1. Sync Tracks

**Endpoint**: `POST /api/v1/tracks/sync`

**Description**: Syncs track catalogue from LiveRC (equivalent to `refresh-tracks` CLI command).

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/tracks/sync
```

**Response**:
```json
{
  "tracks_added": 5,
  "tracks_updated": 145,
  "tracks_deactivated": 2,
  "total_tracks": 150
}
```

**Use Case**: Use this endpoint for programmatic track synchronization.

---

#### 2. Sync Events

**Endpoint**: `POST /api/v1/events/sync?track_id=<track_id>`

**Description**: Syncs events for a specific track (equivalent to `refresh-events` CLI command).

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/events/sync?track_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Response**:
```json
{
  "track_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "events_added": 3,
  "events_updated": 9,
  "total_events": 12
}
```

**Required Query Parameters**:
- `track_id`: Track UUID

**Use Case**: Use this endpoint for programmatic event synchronization.

**Note**: Requires a track ID. See [Retrieving IDs from Database](#retrieving-ids-from-database) section.

---

#### 3. Ingest Event

**Endpoint**: `POST /api/v1/events/{event_id}/ingest`

**Description**: Triggers event ingestion (equivalent to `ingest-event` CLI command).

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/events/c3d4e5f6-a7b8-9012-cdef-123456789012/ingest \
  -H "Content-Type: application/json" \
  -d '{"depth": "laps_full"}'
```

**Request Body**:
```json
{
  "depth": "laps_full"  // Optional: "none" (discovery) or "laps_full" (default, full ingestion)
}
```

**Response**:
```json
{
  "races_ingested": 15,
  "results_ingested": 180,
  "laps_ingested": 8460
}
```

**Required Path Parameters**:
- `event_id`: Event UUID

**Use Case**: Use this endpoint for programmatic event ingestion.

**Note**: Requires an event ID. See [Retrieving IDs from Database](#retrieving-ids-from-database) section.

---

#### 4. Get Ingestion Status

**Endpoint**: `GET /api/v1/ingestion/status/{event_id}`

**Description**: Gets ingestion status for a specific event.

**Request**:
```bash
curl http://localhost:8000/api/v1/ingestion/status/c3d4e5f6-a7b8-9012-cdef-123456789012
```

**Response**:
```json
{
  "event_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "ingest_depth": "laps_full",
  "last_ingested_at": "2025-01-27T14:22:00"
}
```

**Required Path Parameters**:
- `event_id`: Event UUID

**Use Case**: Check the ingestion status of an event programmatically.

**Note**: Requires an event ID. See [Retrieving IDs from Database](#retrieving-ids-from-database) section.

---

## Retrieving IDs from Database

Several commands and operations require IDs (track IDs, event IDs). Here are all the methods to retrieve them:

### Method 1: Using CLI Commands (Easiest)

#### Get Track IDs

Use the `list-tracks` command:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc list-tracks
```

The first column in the output is the track ID (UUID format).

**Example**:
```
Found 150 tracks:
  a1b2c3d4-e5f6-7890-abcd-ef1234567890 | canberraoffroad | Canberra Off Road Model Car Club | Active: True | Followed: False
```

Track ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

#### Get Event IDs

Use the `list-events` command with a track ID:

Docker (Recommended):
```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Local (Alternative):
```bash
python -m ingestion.cli ingest liverc list-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

The first column in the output is the event ID (UUID format).

**Example**:
```
Found 12 events:
  c3d4e5f6-a7b8-9012-cdef-123456789012 | 486677 | 2024 Nationals | 2024-10-15 00:00:00 | Depth: laps_full
```

Event ID: `c3d4e5f6-a7b8-9012-cdef-123456789012`

---

### Method 2: Using TypeScript Scripts

**All TypeScript scripts should be executed inside the Docker container.** This is the recommended and primary method:

```bash
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/<script-name>.ts
```

**Note:** Local execution is also possible if Node.js is installed locally, but Docker execution ensures consistency.

#### Get Track IDs

Run the TypeScript script (Docker - Recommended):

```bash
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-tracks.ts
```

**Alternative (Local - Requires Node.js):**
```bash
npx ts-node scripts/list-tracks.ts
```

**Output**:
```
Track Name                    | Slug              | Source  | Active | Followed | Events | Last Seen
----------------------------------------------------------------------------------------------------------
Canberra Off Road Model Car  | canberraoffroad   | liverc  | Yes    | No       | 12     | 2025-01-27
Sydney RC Racing             | sydneyrc          | liverc  | Yes    | Yes      | 8      | 2025-01-26
...
```

**Note**: This script shows track names and slugs, but **not the UUID**. To get the UUID, you'll need to query the database directly (see Method 3) or use the CLI command (Method 1).

#### Get Event IDs

Run the TypeScript script with a track ID (Docker - Recommended):

```bash
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-events.ts --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Alternative (Local - Requires Node.js):**
```bash
npx ts-node scripts/list-events.ts --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Output**:
```
Track: Canberra Off Road Model Car Club
ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Slug: canberraoffroad
Source: liverc
Active: Yes
Followed: No

Event Name              | Date       | Entries | Drivers | Races | Ingest Depth | Last Ingested      | Source ID
------------------------------------------------------------------------------------------------------------------
2024 Nationals          | 2024-10-15 | 45      | 38      | 15    | laps_full     | 2025-01-27        | 486677
2024 Club Championship  | 2024-11-20 | 32      | 28      | 12    | none          | Never             | 489123
...
```

**Note**: This script shows the Source ID (LiveRC's event ID) but **not the UUID**. To get the UUID, you'll need to query the database directly (see Method 3) or use the CLI command (Method 1).

---

### Method 3: Direct Database Queries (Most Flexible)

#### Using psql (PostgreSQL CLI)

Connect to your database:

```bash
psql $DATABASE_URL
```

#### Get Track IDs

```sql
SELECT id, source_track_slug, track_name, is_active, is_followed
FROM tracks
WHERE source = 'liverc'
ORDER BY track_name;
```

**Example Output**:
```
                  id                  | source_track_slug |           track_name            | is_active | is_followed
--------------------------------------+-------------------+--------------------------------+-----------+-------------
 a1b2c3d4-e5f6-7890-abcd-ef1234567890 | canberraoffroad   | Canberra Off Road Model Car Club| t         | f
 b2c3d4e5-f6a7-8901-bcde-f12345678901 | sydneyrc          | Sydney RC Racing                | t         | t
```

#### Get Event IDs

```sql
SELECT e.id, e.source_event_id, e.event_name, e.event_date, e.ingest_depth, t.track_name
FROM events e
JOIN tracks t ON e.track_id = t.id
WHERE t.source = 'liverc'
ORDER BY e.event_date DESC;
```

**Example Output**:
```
                  id                  | source_event_id |    event_name     |  event_date  | ingest_depth |           track_name
--------------------------------------+-----------------+-------------------+--------------+--------------+--------------------------------
 c3d4e5f6-a7b8-9012-cdef-123456789012 | 486677          | 2024 Nationals    | 2024-10-15   | laps_full    | Canberra Off Road Model Car Club
 d4e5f6a7-b8c9-0123-def0-234567890123 | 489123          | 2024 Club Champ   | 2024-11-20   | none         | Canberra Off Road Model Car Club
```

#### Get Event IDs for a Specific Track

```sql
SELECT e.id, e.source_event_id, e.event_name, e.event_date, e.ingest_depth
FROM events e
WHERE e.track_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY e.event_date DESC;
```

#### Get Event ID by Source Event ID

If you know the LiveRC source event ID (e.g., `486677`), you can find the UUID:

```sql
SELECT id, source_event_id, event_name, event_date
FROM events
WHERE source = 'liverc' AND source_event_id = '486677';
```

---

### Method 4: Using Prisma Client (Programmatic)

If you're writing TypeScript/JavaScript code, you can use Prisma:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Get all tracks
const tracks = await prisma.track.findMany({
  where: { source: 'liverc' },
  select: {
    id: true,
    sourceTrackSlug: true,
    trackName: true,
    isActive: true,
  },
  orderBy: { trackName: 'asc' }
})

// Get events for a track
const events = await prisma.event.findMany({
  where: { trackId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
  select: {
    id: true,
    sourceEventId: true,
    eventName: true,
    eventDate: true,
    ingestDepth: true,
  },
  orderBy: { eventDate: 'desc' }
})

// Get event by source event ID
const event = await prisma.event.findUnique({
  where: {
    source_sourceEventId: {
      source: 'liverc',
      sourceEventId: '486677'
    }
  }
})
```

---

## Complete Workflows

### Workflow 1: Initial Setup and Track Discovery

**Goal**: Discover and populate tracks from LiveRC.

**Steps**:

1. **Refresh tracks from LiveRC**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc refresh-tracks
   ```

2. **List tracks to see what was added**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc list-tracks
   ```

3. **Check status**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc status
   ```

**Expected Result**: Database populated with all active tracks from LiveRC.

---

### Workflow 2: Ingest Events for a Track

**Goal**: Discover and ingest all events for a specific track.

**Steps**:

1. **Get track ID**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc list-tracks
   ```
   
   Note the track ID from the output (first column).

2. **Refresh events for the track**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <track_id>
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc refresh-events --track-id <track_id>
   ```

3. **List events to see what was added**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <track_id>
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc list-events --track-id <track_id>
   ```
   
   Note the event IDs from the output (first column).

4. **Ingest a specific event**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <event_id>
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc ingest-event --event-id <event_id>
   ```

5. **Verify ingestion status**:
   
   Docker (Recommended):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status
   ```
   
   Local (Alternative):
   ```bash
   python -m ingestion.cli ingest liverc status
   ```

**Expected Result**: Event data (races, results, laps) ingested into the database.

---

### Workflow 3: Bulk Ingest Multiple Events

**Goal**: Ingest all events for a track that haven't been ingested yet.

**Steps**:

1. **Get track ID** (Docker):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks
   ```

2. **Refresh events** (Docker):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <track_id>
   ```

3. **List events and filter for uningested ones** (Docker):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <track_id>
   ```
   Look for events with `Depth: none` (these are events that have been discovered but not yet imported).

4. **Ingest each event** (repeat for each event ID, Docker):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <event_id>
   ```

5. **Verify integrity** (Docker):
   ```bash
   docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc verify-integrity
   ```

**Expected Result**: All events for the track fully ingested.

---

### Workflow 4: Using API Endpoints

**Goal**: Perform operations programmatically via REST API.

**Steps**:

1. **Start the API server**:
   ```bash
   cd ingestion/
   python -m ingestion.main
   ```

2. **Sync tracks**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/tracks/sync
   ```

3. **Get track ID from database** (using SQL or CLI):
   ```sql
   SELECT id FROM tracks WHERE source_track_slug = 'canberraoffroad';
   ```

4. **Sync events**:
   ```bash
   curl -X POST "http://localhost:8000/api/v1/events/sync?track_id=<track_id>"
   ```

5. **Get event ID from database**:
   ```sql
   SELECT id FROM events WHERE source_event_id = '486677';
   ```

6. **Ingest event**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/events/<event_id>/ingest \
     -H "Content-Type: application/json" \
     -d '{"depth": "laps_full"}'
   ```

7. **Check ingestion status**:
   ```bash
   curl http://localhost:8000/api/v1/ingestion/status/<event_id>
   ```

**Expected Result**: Operations completed via API.

---

## Troubleshooting

### Common Issues

#### 1. "Track not found" Error

**Problem**: Command fails with "Track {track_id} not found."

**Solution**:
- Verify the track ID is correct (use `list-tracks` to get the exact UUID)
- Ensure the track exists in the database
- Check that you're using the UUID format, not the source track slug

**Example** (Docker):
```bash
# Wrong - using slug instead of UUID
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id canberraoffroad

# Correct - using UUID
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

#### 2. "Event not found" Error

**Problem**: Command fails with "Event {event_id} not found."

**Solution**:
- Verify the event ID is correct (use `list-events` to get the exact UUID)
- Ensure the event exists in the database
- Check that you're using the UUID format, not the source event ID

**Example** (Docker):
```bash
# Wrong - using source event ID instead of UUID
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id 486677

# Correct - using UUID
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id c3d4e5f6-a7b8-9012-cdef-123456789012
```

---

#### 3. Docker Container Not Running

**Problem**: Docker commands fail with "Error: No such container: mre-liverc-ingestion-service" or "Cannot connect to the Docker daemon".

**Solution**:
- **Check if container is running:**
  ```bash
  docker ps | grep mre-liverc-ingestion-service
  ```

- **Start the ingestion service:**
  ```bash
  docker compose up -d liverc-ingestion-service
  ```

- **Verify container is healthy:**
  ```bash
  docker logs mre-liverc-ingestion-service
  curl http://localhost:8000/health
  ```

- **If container doesn't exist, rebuild it:**
  ```bash
  docker compose build liverc-ingestion-service
  docker compose up -d liverc-ingestion-service
  ```

---

#### 4. Database Connection Errors

**Problem**: Commands fail with database connection errors.

**Solution** (Docker):
- **Verify PostgreSQL container is running:**
  ```bash
  docker ps | grep mre-postgres
  ```

- **Check database connection from ingestion container:**
  ```bash
  docker exec -it mre-liverc-ingestion-service python -c "import os; print(os.getenv('DATABASE_URL'))"
  ```

- **Test database connectivity:**
  ```bash
  docker exec -it mre-postgres psql -U pacetracer -d pacetracer -c "SELECT 1"
  ```

- **Verify Docker network:**
  ```bash
  docker network inspect my-race-engineer_mre-network
  ```

**Solution** (Local):
- Verify `DATABASE_URL` environment variable is set correctly
- Check that PostgreSQL is running
- Test connection: `psql $DATABASE_URL`

---

#### 5. HTTP Errors During Ingestion

**Problem**: Ingestion fails with HTTP errors (502, timeout, etc.).

**Solution** (Docker):
- **Check container logs for detailed errors:**
  ```bash
  docker logs mre-liverc-ingestion-service
  ```

- **Verify Playwright is installed in container:**
  ```bash
  docker exec -it mre-liverc-ingestion-service playwright --version
  ```

- **Check network connectivity from container:**
  ```bash
  docker exec -it mre-liverc-ingestion-service curl -I https://live.liverc.com
  ```

- **Check network connectivity to LiveRC**
- **Verify LiveRC website is accessible**
- **Some pages may require Playwright (browser automation)** - Playwright is pre-installed in the Docker container

**Solution** (Local):
- Check network connectivity to LiveRC
- Verify LiveRC website is accessible
- Check logs for specific error messages
- Ensure Playwright is installed: `playwright install chromium`

---

#### 6. Integrity Check Failures

**Problem**: `verify-integrity` reports issues.

**Solution**:
- Review the specific issues reported
- Orphaned races/results may indicate incomplete ingestion - re-run ingestion for affected events
- Missing lap data may indicate parsing issues - check logs for parsing errors
- Consider re-ingesting affected events

---

### Getting Help

1. **Check Logs**: All commands output structured logs. Review them for detailed error information.

2. **Verify Database State**: Use SQL queries to inspect the database directly.

3. **Test Connectivity**: Ensure you can access LiveRC website and your database.

4. **Review Architecture Docs**: See `docs/architecture/liverc-ingestion/` for detailed architecture information.

---

## Quick Reference

### Command Cheat Sheet

**Docker Execution** (Recommended - Primary Method):
```bash
# List all tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks

# Refresh tracks from LiveRC
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks

# List events for a track
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <UUID>

# Refresh events for a track (metadata only)
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <UUID> --depth none

# Refresh events and perform full ingestion for new events
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <UUID> --depth laps_full --ingest-new-only

# Ingest an event
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <UUID>

# Check system status
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status

# Verify data integrity
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc verify-integrity
```

**Local Execution** (Alternative - Requires Python Setup):
```bash
# List all tracks
python -m ingestion.cli ingest liverc list-tracks

# Refresh tracks from LiveRC
python -m ingestion.cli ingest liverc refresh-tracks

# List events for a track
python -m ingestion.cli ingest liverc list-events --track-id <UUID>

# Refresh events for a track (metadata only)
python -m ingestion.cli ingest liverc refresh-events --track-id <UUID> --depth none

# Refresh events and perform full ingestion for new events
python -m ingestion.cli ingest liverc refresh-events --track-id <UUID> --depth laps_full --ingest-new-only

# Ingest an event
python -m ingestion.cli ingest liverc ingest-event --event-id <UUID>

# Check system status
python -m ingestion.cli ingest liverc status

# Verify data integrity
python -m ingestion.cli ingest liverc verify-integrity
```

### SQL Query Cheat Sheet

```sql
-- Get all track IDs
SELECT id, source_track_slug, track_name FROM tracks WHERE source = 'liverc';

-- Get all event IDs for a track
SELECT id, source_event_id, event_name FROM events WHERE track_id = '<track_uuid>';

-- Get event ID by source event ID
SELECT id FROM events WHERE source = 'liverc' AND source_event_id = '486677';

-- Get events that need ingestion
SELECT id, event_name, ingest_depth FROM events WHERE ingest_depth != 'laps_full';
```

---

**End of Document**
