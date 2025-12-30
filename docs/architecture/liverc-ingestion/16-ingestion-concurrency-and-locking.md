---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Concurrency control and locking mechanisms for ingestion operations
purpose: Defines concurrency, locking, and mutual-exclusion guarantees for the LiveRC
         ingestion subsystem. Ensures strong mutual exclusion per event while allowing
         parallel ingestion across different events to prevent data corruption and
         duplicate ingestion.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/08-ingestion-pipeline-internals.md
  - docs/architecture/liverc-ingestion/14-ingestion-idempotency-design.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 16. Ingestion Concurrency and Locking

This document defines the concurrency, locking, and mutual-exclusion guarantees required for the LiveRC ingestion subsystem in My Race Engineer (MRE). Concurrency control is mandatory to prevent data corruption, duplicate ingestion, and overlapping executions that produce nondeterministic outcomes.

The goal is to enforce ingestion correctness while supporting future scaling, distributed ingestion, and multiple execution pathways (admin UI, CLI, scheduled jobs).

---

## 1. Concurrency Threat Model

Ingestion operations may originate from:

- Admin clicking “Ingest” in the UI  
- CLI ingestion commands (cron or manual)  
- Future automated refresh tasks  

Concurrency risks include:

- Two ingestion operations starting for the same event  
- A partial ingestion updating DB rows while another process reads incomplete data  
- A crash leaving an ingestion “half-done”  
- Race conditions in Playwright or HTTPX fetchers  
- Distributed ingestion nodes running the same job  

Ingestion must provide **strong mutual exclusion per event**, but **allow parallel ingestion across different events**.

---

## 2. Locking Model Overview

MRE uses a **per-event logical lock** that guarantees:

- Only one ingestion job may run for a given event_id at a time  
- Concurrent requests for the same event must be rejected or queued  
- The lock must survive process crashes  
- The lock must be automatically released when ingestion finishes or times out  

This is implemented using a **database-backed advisory lock** or a **row-level lock** (exact mechanism depends on the DB engine). PostgreSQL advisory locks are recommended.

---

## 3. Lock Acquisition Rules

When ingestion begins:

1. Initial connector work (event page fetch + entry list fetch) happens **before** any locks are requested so we never block the database while waiting on LiveRC.  
2. Immediately before persisting anything, the system attempts to acquire the per-event ingestion lock.  
3. If the lock **fails**, the system must return:
   - error code: INGESTION_IN_PROGRESS  
   - HTTP status: 409 (Conflict)
   - a message indicating ingestion is already running  
4. If the lock **succeeds**, the pipeline performs all database writes (including race fetching and persistence) within the locked transaction and releases the lock as soon as persistence is complete.

**Current Implementation**: The lock is held during the entire persistence stage, including race page fetching. This ensures data consistency but means the lock duration includes network I/O for race pages. The lock must be **released even on failure** and the caller must surface the structured error via the `IngestionServiceError` class which preserves error codes through the API boundary.

---

## 4. Lock Granularity

### 4.1 Per-Event Lock  
This lock guards all database writes (entry list persistence, race persistence, driver matching, ingest_depth updates). Initial event page and entry list fetching happens prior to acquiring this lock. Race page fetching occurs within the locked transaction to ensure consistency.  
Granularity: event_id (computed via `_compute_lock_id("event:{event_id}")`)  
Scope: entire persistence stage including race fetching and database writes.

### 4.2 Source-Event Lock  
Used only by the "ingest by source" flow to prevent duplicate Event creation.  
Granularity: source_event_id (hashed advisory lock)  
Scope: creation/upsert of the Event row before the per-event lock is acquired.

### 4.3 Per-Race Lock (Optional Future Feature)  
This may be used for distributed ingestion of massive events but is not required in V1.

### 4.4 Global Lock (Not Recommended)  
A global lock (disallowing any simultaneous ingestion at all) is explicitly prohibited because:

- tracks are independent  
- events are independent  
- ingestion needs to scale  

---

## 5. Lock Duration and Timeout

### 5.1 Expected Duration  
A single event ingestion is expected to take:

- small events: 2–10 seconds  
- medium events: 10–45 seconds  
- large multi-class events: 45–120 seconds

### 5.2 Automatic Timeout  
To prevent deadlocks, ingestion locks must time out:

- **Implemented timeout**: 5 minutes (`LOCK_TIMEOUT_SECONDS = 5 * 60`)  
- Enforced via `asyncio.wait_for()` wrapper in `_run_with_timeout()` method  
- On timeout, raises `IngestionTimeoutError` with event_id and current stage  
- Metrics are recorded via `metrics.record_lock_timeout(event_id, stage)`  
- The lock is automatically released when the timeout exception is raised  

If a timeout occurs, observability logs capture:

- event_id  
- current ingestion stage (via `_set_stage()` tracking)  
- timeout duration (5 minutes)  
- ingestion timer status (marked as "timeout")  

---

## 6. Atomic State Transitions

Ingestion state transitions must be atomic under concurrency control.

### 6.1 Valid Transitions

- none → laps_full  
- laps_full → laps_full (idempotent re-run)  

### 6.2 Invalid Transitions

- laps_full → none  
- any backwards transition  

Concurrency enforcement ensures no second process can perform an illegal downgrade while a valid ingestion is in progress.

---

## 7. Isolation of Writes

DB writes during ingestion must be executed within controlled transaction boundaries.

### 7.1 Transaction Scope

**Current Implementation**: The entire persistence stage runs within a single database transaction (`db_session()` context), but commits are performed at logical boundaries:

- Event metadata update (flush only)  
- Entry list persistence (commit after all entries processed)  
- Race processing (commit after each race is fully persisted, including results and laps)  
- Driver matching + auto-confirm (commit after matching complete)  
- ingest_depth/last_ingested_at update (final commit)

The advisory lock is held for the duration of this transaction, which includes race page fetching. This ensures consistency but means lock duration includes network I/O for race pages. Race fetching is sequential (concurrency = 1) per v0.1 performance requirements.  

### 7.2 Idempotent Upserts

Ingestion MUST use deterministic upsert logic:

- identical input must never create extra rows  
- repeated ingestion must produce identical results  
- race_results and laps must always overwrite outdated data  

Isolation level: `READ COMMITTED` is sufficient because the advisory lock guarantees exclusive access for the event.

---

## 8. Prevention of Cascade Failures

Concurrency strategy must avoid situations where:

- one stuck ingestion blocks all future ingestion  
- one long-running task blocks admin operations  
- unexpected DB locks propagate  

To prevent these:

- ingestion must break work into smaller stages  
- ingestion lock must only protect concurrency, not entire table operations  
- race-level writes must avoid table-wide locks  
- failures must release locks immediately  

---

## 9. Handling Concurrent Frontend Reads

Frontend requests (race results, laps, event details) may be served while ingestion is running.

Rules:

- reads must not block ingestion  
- ingestion must not block reads  
- partial ingestion state must not appear as complete  
- frontend must respect ingest_depth  
- the system should not expose partially ingested races as if complete  

To enforce this:

- ingest_depth must be updated only when ingestion is fully complete  
- race rows should be inserted only after normalisation is complete  
- lap data should never appear for races not yet fully processed  

---

## 10. CLI and Admin UI Concurrency Rules

### 10.1 CLI Ingestion  
CLI can trigger ingestion but must obey locking:

- if lock cannot be acquired, print clear message  
- may provide a flag to “wait for lock”  

### 10.2 Admin UI  
Admin UI must:

- poll ingestion state  
- never attempt parallel runs for the same event  
- display ingestion progress  
- display "ingestion already running" errors (mapped to HTTP 409 via `toHttpErrorPayload()`)

**Current Implementation**: The Next.js API routes (`src/app/api/v1/events/[eventId]/ingest/route.ts` and `src/app/api/v1/events/ingest/route.ts`) properly handle `IngestionServiceError` exceptions and map `INGESTION_IN_PROGRESS` to HTTP 409 with a user-friendly message. The error payload is preserved through the `ingestion-client.ts` layer using the `IngestionServiceError` class.  

---

## 11. Concurrency Guarantees Summary

The ingestion system must guarantee:

1. Only one ingestion per event at any time  
2. Locks persist across crashes  
3. Idempotent ingestion results  
4. Transaction boundaries with logical commits to minimize lock duration  
5. Deterministic and conflict-free writes  
6. Non-blocking reads during ingestion  
7. No race conditions in connector fetches  
8. Clear failure modes when concurrency violations occur

**Note on Transaction Scope**: The current implementation uses a single transaction for the entire persistence stage (including race fetching) with logical commits at boundaries. This ensures consistency but means the advisory lock is held during network I/O for race pages. Future optimizations may move race fetching outside the locked transaction while maintaining consistency guarantees.  

These guarantees ensure ingestion stability even under bursty admin usage, cron-triggered ingestion, or future multi-node runtimes.

---

End of 16-ingestion-concurrency-and-locking.md.
