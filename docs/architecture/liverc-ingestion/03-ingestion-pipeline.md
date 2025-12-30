---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Ingestion pipeline specification for LiveRC data ingestion
purpose: Defines the ingestion service layer that coordinates connector calls, handles
         database writes, ensures idempotency, and defines ingestion depth. This document
         specifies the end-to-end pipeline flow from event discovery through complete
         data ingestion.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/02-connector-architecture.md
  - docs/architecture/liverc-ingestion/07-ingestion-state-machine.md
  - docs/architecture/liverc-ingestion/08-ingestion-pipeline-internals.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# Ingestion Pipeline Specification

**Status:** This ingestion subsystem is **in scope for version 0.1.1 release**. See [MRE Version 0.1.1 Feature Scope](../../specs/mre-v0.1-feature-scope.md) for version 0.1.1 feature specifications.

**Related Documentation:**
- [LiveRC Ingestion Overview](01-overview.md) - System overview
- [Mobile-Safe Architecture Guidelines](../mobile-safe-architecture-guidelines.md) - Overall MRE architecture principles

## Purpose

The Ingestion Pipeline is responsible for retrieving data from external sources
(via Connectors), validating and transforming that data, and persisting it into
MRE’s internal domain models. It enforces all ingestion rules, sequencing,
idempotency, and depth control.

Connectors must **not** write to the database.  
UI layers must **not** communicate directly with connectors.  
All ingestion flows must pass through the Ingestion Service.

This ensures correctness, testability and future multi-connector support.

---

# High-Level Responsibilities

The Ingestion Pipeline performs three major operations:

1. **Track Catalogue Sync**  
2. **Event Catalogue Sync**  
3. **Deep Event Ingestion (Races + Results + Laps)**  

Each operation has clear separation, well-defined inputs and outputs, and strict
ordering.

---

# 1. Track Catalogue Sync

### Purpose
Maintain a complete list of all LiveRC tracks locally in the MRE database.

### Triggered By
- CLI command: `mre tracks sync`
- Admin console: “Sync Tracks” button
- Optional cron job (weekly or daily)

### Data Source
`https://live.liverc.com` via `LiveRCConnector.listTracks()`

### Behaviour
1. Fetch full track list from LiveRC.
2. For each track:
   - Upsert by `source_track_slug`.
   - Update metadata such as:
     - track_name
     - track_url
     - events_url
     - last_seen_at
     - liverc_track_last_updated
3. Mark any previously known LiveRC tracks that no longer appear as `is_active = false`.

### Notes
- No events or race data is fetched in this step.
- This is the only ingestion operation allowed to be run proactively.

---

# 2. Event Catalogue Sync (Per Track)

### Purpose
Populate MRE’s local database with all events for a specific track, without
ingesting any detailed race data.

### Triggered By
- CLI: `ingest liverc refresh-events --track-id {id} --depth {none|laps_full}`
- Admin console: “Sync Events for This Track” button

### Data Source
`https://{slug}.liverc.com/events`  
via `LiveRCConnector.listEventsForTrack(track)`

### Behaviour
1. Validate that the track exists in MRE’s database.
2. Fetch all event summaries for the track.
3. Upsert Event rows using `source_event_id` as the unique key.
4. Update fields including:
   - event_name  
   - event_date  
   - event_entries  
   - event_drivers  
   - event_url  
5. Set `ingest_depth = "none"` for newly discovered events.
6. Do **not** modify `ingest_depth` for previously ingested events.

### Optional Full Ingestion
If `--depth laps_full` is specified:
- **Phase 1**: Event discovery (as above)
- **Phase 2**: Full ingestion for selected events
  - With `--ingest-new-only` (default): Only ingest events that were just created
  - With `--ingest-all`: Ingest all events for the track (re-ingestion is idempotent)
- This combines event discovery and full ingestion into a single command

### Notes
- With `--depth none`: No race sessions or laps are scraped at this stage.
- With `--depth laps_full`: Full pipeline runs for selected events (races, results, laps).
- Users will search these Events using the Held-Between flow.

---

# 3. Deep Event Ingestion (On Demand)

### Purpose
Retrieve the full details of an event only when a user selects that event from
search results.

### Triggered By
- MRE end user selects an event in the UI.
- CLI: `mre events ingest --event {id} --depth laps_full`

### Ingestion Depths
- `"none"`: Event metadata only (no race data ingested). Used for event discovery/browsing.
- `"laps_full"`: Full ingestion including races, results, and per-driver lap data.

**V1 Note**: In V1, "Import Event" always means full ingestion (`laps_full`). Event discovery creates events at `none` depth for browsing, but when a user imports an event, they always get complete data (races + results + laps).

### Data Sources
Via the LiveRCConnector:
- Event details page  
- Entry list page (REQUIRED - ingestion fails if missing)
- Race list page  
- Individual race result pages  
- `racerLaps[...]` JS data blocks for lap series  

### Behaviour (Entry-List-First Architecture)
1. Validate event exists in DB.
2. Check `ingest_depth`:
   - If `"laps_full"`: return immediately (cached).
3. Fetch event-level summary if needed.
4. **Fetch entry list (REQUIRED)**:
   - Entry list is fetched and parsed BEFORE race results
   - If entry list is missing or empty, ingestion fails with ValidationError
   - Entry list provides definitive driver list and transponder numbers
5. **Process entry list**:
   - Create/update Driver records from entry list
   - Create EventEntry records for each driver-class combination
   - Store transponder numbers from entry list
6. Fetch list of races (heats, qualifiers, mains).
7. For each race:
   - Fetch driver results.
   - Match race result drivers to EventEntry records (by driver ID or name)
   - Update Driver `sourceDriverId` from temporary to real ID if matched
   - Upsert Race, RaceDriver, RaceResult.
   - Note: Transponder numbers are stored in EventEntry (source of truth), not RaceDriver.
8. For each race result:
   - Fetch lap data using connector.
   - Upsert Lap rows (with safe dedupe by race_result_id + lap_number).
9. Match users to drivers:
   - Preload all users and existing user-driver links.
   - For each driver in the event, find matching users using fuzzy matching:
     - Transponder match (primary strategy)
     - Exact normalized name match
     - Fuzzy name match (Jaro-Winkler similarity >= 0.85)
   - Create/update UserDriverLink records (status: confirmed, suggested, or conflict).
   - Create EventDriverLink records to track event-specific matches.
   - Run auto-confirmation: Check for transponder matches across 2+ events and auto-confirm links when name compatibility is verified.
10. Update event:
   - `ingest_depth = "laps_full"`
   - `last_ingested_at = now()`

### Notes
- This action can be long-running but must provide progress updates to the UI.
- Ingestion must be idempotent: running twice should not create duplicates.

### Timeout & Pending Responses

LiveRC imports can exceed the 10-minute HTTP budget enforced by Next.js API
routes. When a timeout or transient connection drop occurs, the ingestion API
now polls the database for a few seconds before responding:

- If the Python pipeline finished despite the timeout, the API replies with a
  normal success payload (`status: "already_complete"`).
- If the pipeline is still running, the API returns `202 Accepted` with
  `status: "in_progress"`. The UI keeps the event row in an “Importing…” state
  and retries the search automatically.

This ensures users are never told an import failed when the data is still being
processed in the background.

---

# Idempotency Rules

The ingestion service must enforce predictable behaviour:

### Upsert Keys
- Track: `source = "liverc"`, `source_track_slug`
- Event: `source = "liverc"`, `source_event_id`
- Driver: `source = "liverc"`, `source_driver_id` (may be temporary "entry_*" ID initially)
- EventEntry: `(event_id, driver_id, class_name)`
- Race: `(event_id, source_race_id)` if available, else synthetic hash
- RaceDriver: `(race_id, source_driver_id)`
- RaceResult: `(race_id, race_driver_id)`
- Lap: `(race_result_id, lap_number)`

### Retry Safety
If ingestion dies mid-way:
- Re-running must complete without corrupting state.
- No duplicate laps, races, or drivers may be created.

---

# Database Write Model

The ingestion pipeline must:

- Never delete data unless explicitly required by retention rules (future).
- Only perform inserts and updates.
- Use transactions where logical boundaries exist (per race or per event).
- Provide clear logging for:
  - New records
  - Updated records
  - Skipped (unchanged) records

---

# Logging Requirements

Ingestion must log at minimum:

- Start and end of each ingestion operation.
- External URLs being fetched.
- Number of tracks/events/races/results/laps processed.
- Any parsing anomalies.
- Summary of state changes (new/updated/skipped).

Logs should be suitable for:
- `journalctl`
- Browser console logs (admin UI)
- Automated diagnostics

---

# CLI Integration

CLI commands act as thin wrappers around the ingestion service:

### `mre tracks sync`
- Runs Track Catalogue Sync.

### `ingest liverc refresh-events --track-id {id} --depth {none|laps_full}`
- Runs Event Catalogue Sync for a single track.
- With `--depth none`: Only discovers events (metadata only).
- With `--depth laps_full`: Discovers events and optionally performs full ingestion.
  - Use `--ingest-new-only` (default) to only ingest newly discovered events.
  - Use `--ingest-all` to ingest all events for the track.

### `ingest liverc ingest-event --event-id {id} --depth laps_full`
- Runs Deep Event Ingestion for a specific event (legacy command, still supported).

All CLI operations must exit with:
- `0` for success  
- non-zero for structured failure  

---

# Admin Console Integration

The admin UI must expose controls to:

- Sync tracks  
- Sync events for a track  
- Re-ingest a single event  
- View ingestion status  
- Monitor ingestion logs  

All admin UI API calls are routed through the ingestion service.

---

# Anti-Bot Constraints

The ingestion pipeline must never:

- Continuously hit LiveRC for race results that nobody asked for.
- Re-scrape already ingested events unless explicitly commanded.
- Scrape events in bulk simply because they exist.

The only proactive scraper is the Track Catalogue Sync.

---

# Summary

The ingestion pipeline defines:

- **What** data is retrieved  
- **When** it is retrieved  
- **How** it is retrieved  
- **How** it is persisted  

By separating Connectors from the Ingestion Service, and layering ingestion flows
from Track → Event → Race → Results → Laps, MRE ensures robustness, scalability,
anti-bot compliance and predictable behaviour.

This document is the canonical reference for all ingestion-related logic.
