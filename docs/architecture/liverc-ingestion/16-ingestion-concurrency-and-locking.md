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
  - docs/specs/mre-alpha-feature-scope.md
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

1. The system attempts to acquire the per-event ingestion lock.  
2. If the lock **fails**, the system must return:
   - error code: INGESTION_IN_PROGRESS  
   - a message indicating ingestion is already running  
3. If the lock **succeeds**, ingestion proceeds normally.

The lock must be **held for the full ingestion duration**, including all sub-stages (fetching, parsing, normalisation, persistence).

The lock must be **released even on failure**.

---

## 4. Lock Granularity

### 4.1 Per-Event Lock  
This is the only mandatory lock.  
Granularity: event_id  
Scope: entire ingestion pipeline for the event.

### 4.2 Per-Race Lock (Optional Future Feature)  
This may be used for distributed ingestion of massive events but is not required in V1.

### 4.3 Global Lock (Not Recommended)  
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

- recommended timeout: 5 minutes  
- after timeout, a lock is forcibly cleared  
- ingestion state is set to failed  

If a timeout occurs, observability logs MUST capture:

- event_id  
- lock acquisition duration  
- stage where the process hung  

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

Each race should be persisted in its own short-lived transaction:

- avoids long transactions that lock too many rows  
- improves crash resilience  
- makes ingestion progress visible incrementally  

### 7.2 Idempotent Upserts

Ingestion MUST use deterministic upsert logic:

- identical input must never create extra rows  
- repeated ingestion must produce identical results  
- race_results and laps must always overwrite outdated data  

Isolation level: `READ COMMITTED` is sufficient because ingestion has exclusive access for the event.

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
- display “ingestion already running” errors  

---

## 11. Concurrency Guarantees Summary

The ingestion system must guarantee:

1. Only one ingestion per event at any time  
2. Locks persist across crashes  
3. Idempotent ingestion results  
4. Short-lived transactions to avoid DB contention  
5. Deterministic and conflict-free writes  
6. Non-blocking reads during ingestion  
7. No race conditions in connector fetches  
8. Clear failure modes when concurrency violations occur  

These guarantees ensure ingestion stability even under bursty admin usage, cron-triggered ingestion, or future multi-node runtimes.

---

End of 16-ingestion-concurrency-and-locking.md.
