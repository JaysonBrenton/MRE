---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Internal runtime behaviour and orchestration rules for ingestion pipeline
purpose: Defines the internal runtime behaviour, orchestration rules, and determinism
         guarantees of the LiveRC ingestion pipeline. Specifies implementation details,
         execution flow, and internal coordination mechanisms beyond the conceptual
         pipeline overview.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/07-ingestion-state-machine.md
  - docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 08. Ingestion Pipeline Internals (LiveRC Ingestion Subsystem)

This document defines the internal runtime behaviour, orchestration rules, and
determinism guarantees of the LiveRC ingestion pipeline for My Race Engineer
(MRE). Unlike `03-ingestion-pipeline.md`, which defines the conceptual pipeline
stages, this document describes the mechanics of how ingestion actually runs,
how each stage interacts with the database, how idempotency is enforced, and
how failures are contained.

This document governs CLI ingestion and API-triggered ingestion.

---

## 1. Goals of the Ingestion Pipeline

The ingestion pipeline MUST achieve:

1. Deterministic ingestion  
   Same LiveRC input → identical DB state.

2. Idempotency  
   Re-running ingestion for the same event MUST NOT create duplicate rows.

3. Atomicity at event scope  
   Partial ingestion should never corrupt or partially populate DB tables.

4. Complete separation between:  
   - scraping (connector)
   - parsing (connector)
   - normalisation
   - DB persistence
   - API read layers

5. Robustness against LiveRC inconsistencies  
   The pipeline SHOULD tolerate variations such as missing fields, blank pace
   strings, or non-standard orderings.

6. Clean orchestration via a single entrypoint:
   `ingest_event(event_id, depth="laps_full")`.

---

## 2. High-Level Pipeline Flow

The ingestion runtime executes the following stages in strict order:

1. Fetch and parse event page (connector)
2. Extract race metadata
3. Fetch and parse each race result page (connector)
4. Extract results table per race
5. Extract lap time series per driver
6. Normalise to structured ingestion models
7. Persist into DB using idempotent upserts
8. Match users to drivers (fuzzy matching and auto-confirmation)
9. Update ingestion state and timestamps

Each stage MUST succeed before the next begins.

---

## 3. Orchestration Model

### 3.1 Single Controller: ingest_event()
All ingestion flows MUST be orchestrated through a single function:

`ingest_event(event_id, depth="laps_full")`

This function:

- Validates transitions allowed by the state machine  
- Loads event metadata  
- Locks ingestion for this event  
- Delegates scraping to connector modules  
- Delegates parsing to domain parsers  
- Persists data via repository layer  
- Releases locks  
- Updates ingestion status

No other function may perform cross-stage orchestration.

---

## 4. Locking, Concurrency, and Throttling

### 4.1 Event-Level Lock
To prevent two ingestions of the same event running concurrently:

- A DB-level advisory lock MUST be used per event_id.
- If the lock cannot be acquired, ingestion MUST return an error:
  `INGESTION_IN_PROGRESS`.

### 4.2 Global Throttle
The ingestion system SHOULD enforce:

- No more than N ingestion jobs per minute (configurable).
- Protection against unbounded parallelism.

These limits prevent unnecessary load on the LiveRC site and MRE server.

---

## 5. Connector Interaction

### 5.1 Connector Boundaries
The ingestion system MUST NOT fetch HTML or use Playwright directly.

Instead, it calls connector functions:

- `fetch_event_page(event)`  
- `fetch_race_page(race)`  
- `fetch_laps_data(race, driver)` (if needed)

Each connector function returns structured domain objects, never raw HTML.

### 5.2 Response Contracts
Connector output MUST satisfy strict schemas:

- Event metadata object
- Race metadata objects
- Race results objects
- Lap series objects

Invalid or missing fields MUST raise structured errors.

---

## 6. Normalisation Layer

Before persisting, the ingestion pipeline MUST normalise scraped data into
canonical ingestion models:

- `IngestedRace`
- `IngestedRaceResult`
- `IngestedDriver`
- `IngestedLap`

Normalisation responsibilities:

1. Convert strings to numeric values
2. Parse timestamps and durations
3. Interpret LiveRC identifiers consistently (source_event_id, source_race_id, source_driver_id)
4. Clean whitespace and inconsistent fields
5. Expand pace strings into structured fields (optional future extension)

Normalisation MUST NOT touch the DB.

---

## 7. Persistence Layer

### 7.1 Upsert Strategy
All writes MUST be idempotent:

- Insert new records
- Update existing records if they already exist
- Never delete data during ingestion
- Never duplicate rows when re-ingesting

### 7.2 Transaction Boundaries
Each major block MUST be wrapped in a DB transaction:

1. Insert/update races
2. Insert/update results
3. Insert/update drivers
4. Insert/update laps

If any block fails, the entire ingestion MUST roll back to the previous safe
state.

### 7.3 Foreign Key Enforcement
The pipeline MUST ensure:

- Races reference the correct event
- RaceResults reference the correct race
- RaceDrivers reference the correct race result
- Laps reference the correct race result

---

## 8. Idempotency Guarantees

Re-ingestion MUST NOT:

- Create duplicate races
- Create duplicate results
- Create duplicate drivers
- Create duplicate laps

It MUST:

- Update changed fields deterministically
- Leave untouched fields unchanged
- Refresh timestamps when appropriate

Even if LiveRC reorders drivers or laps, the ingestion layer MUST detect that
records correspond to the same logical entity based on source IDs.

---

## 9. Failure Handling

### 9.1 Fail-Fast on Invalid Structure
If a required field is missing or malformed:

- The ingestion MUST halt immediately
- The DB state MUST remain unchanged (rollback)
- The error MUST be returned to the caller

### 9.2 Partial Data Recovery
If some race pages fail to load:

- The entire ingestion is considered failed
- No partial state is written

### 9.3 Connector Errors
Low-level errors MUST be normalised into MRE-specific ingestion errors, never
propagating raw HTTP or Playwright exceptions to the caller.

---

## 10. Determinism Rules

Ingestion MUST:

1. Return the same race ordering every time  
2. Return drivers in the order they appear in LiveRC results  
3. Store laps in ascending lap_number order  
4. Produce identical DB rows for identical HTML input

This rule is essential for analytics, caching, and reproducibility.

---

## 11. Observability and Logging

The ingestion pipeline MUST emit structured logs for:

- start and end of ingestion runs
- state transitions
- connector fetch durations
- normalisation decisions
- DB write counts
- error stacks

Logs MUST be JSON for compatibility with external monitoring systems.

---

## 12. Hooks and Future Extension Points

The pipeline MUST reserve space for:

1. Derived metric generation  
   - consistency metrics  
   - segment averages  
   - driver comparisons  

2. Background ingestion tasks  
   (e.g., nightly catalogue refresh)

3. Additional ingest_depth values  
   (laps_segmented, telemetry_extended)

Note: `summary_only` was considered for V1 but was removed to simplify the architecture.

All added functionality MUST still honour:

- state machine rules
- idempotency
- determinism

---

End of 08-ingestion-pipeline-internals.md.
