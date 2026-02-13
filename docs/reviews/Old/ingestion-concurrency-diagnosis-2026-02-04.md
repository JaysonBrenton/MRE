# Ingestion Pipeline Concurrency – Diagnosis Report

**Date:** 2026-02-04  
**Scope:** How the ingestion service handles multiple users ingesting events at
the same time. No code changes; diagnosis and testing only.

**Update (2026-02-04):** An **in-process async job queue** was added after this
diagnosis. When `INGESTION_USE_QUEUE=true` (default), ingest endpoints return
202 with `job_id` and clients poll for status. See
[28. Async Ingestion Queue](../architecture/liverc-ingestion/28-async-ingestion-queue.md).
The rest of this document remains valid for locking, worker model when queue is
disabled, and historical context.

**Related:**
`docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md`
(design); `docs/architecture/liverc-ingestion/28-async-ingestion-queue.md`
(async queue); `ingestion/scripts/cron-entrypoint.sh`;
`src/lib/ingestion-lock.ts`; `ingestion/db/repository.py` (advisory locks).

---

## 1. Executive Summary

- **Job queue (added 2026-02-04):** When `INGESTION_USE_QUEUE=true` (default),
  ingestion is asynchronous: POST returns 202 with `job_id`, and an in-process
  queue + workers process jobs. See
  [28. Async Ingestion Queue](../architecture/liverc-ingestion/28-async-ingestion-queue.md).
  When the queue is disabled, the following applies: ingestion is synchronous
  per HTTP request; each request runs the full pipeline and holds a worker until
  completion (or timeout).
- **Concurrency limit = uvicorn workers:** With `UVICORN_WORKERS=4` (default),
  up to **4** long-running ingestions can run at once (one per worker).
  Additional requests wait for a free worker.
- **Per-event and per–source-event locking:** Implemented with **PostgreSQL
  advisory locks** in the Python service. Same event or same `source_event_id`
  cannot be ingested twice at once; different events can run in parallel.
- **Next.js lock:** Only used for **existing event** ingest
  (`POST …/events/[eventId]/ingest`). The **new-event** path
  (`POST …/events/ingest` by `source_event_id`) has **no** Next.js lock and
  **no** rate limit on that route.
- **Risks under load:** Connection pool exhaustion, no global cap on concurrent
  ingestions beyond worker count, and no backpressure/queue for “ingest by
  source” other than rate limit on the other route and LiveRC throttle.

---

## 2. Request Path and Process Model

### 2.1 Two Ingestion Entry Points

| Entry point                                              | Next.js route                          | Python endpoint                         | Next.js lock?                               | Rate limit?                           |
| -------------------------------------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------- | ------------------------------------- |
| Ingest **existing** event (by DB `eventId`)              | `POST /api/v1/events/[eventId]/ingest` | `POST /api/v1/events/{event_id}/ingest` | **Yes** (`ingestion-lock.ts` per `eventId`) | Yes (10/min, `RATE_LIMITS.ingestion`) |
| Ingest **new** event (by `source_event_id` + `track_id`) | `POST /api/v1/events/ingest`           | `POST /api/v1/events/ingest`            | **No**                                      | **No**                                |

So when “multiple users import events at the same time” from **event search**
(new events), every request goes straight to the Python service with no
per-request lock or ingestion rate limit on that route.

### 2.2 Python Service: Uvicorn Workers

- **Default:** `UVICORN_WORKERS=4` (set in
  `ingestion/scripts/cron-entrypoint.sh`, overridable via env).
- **Development:** `UVICORN_RELOAD=true` → single worker, no parallelism.
- **Production (default in compose):** `UVICORN_RELOAD=false` → 4 worker
  **processes**.

Each worker is a separate OS process:

- Own SQLAlchemy engine and connection pool (`pool_size=10`, `max_overflow=20`
  per process → up to 30 connections per worker).
- Own `SitePolicy` and per-host throttle state (e.g. 8 concurrent requests to
  `*.liverc.com` per worker).
- No shared in-memory state between workers.

So **at most 4** ingestions can be “in progress” at once (one per worker). A 5th
request is accepted by the load balancer and sits in that worker’s event loop
until a slot is free; there is no explicit queue object, just TCP/HTTP
acceptance and async handling.

### 2.3 Async vs Blocking in the Pipeline

- Route handlers are `async def`; the pipeline uses `await` for I/O (connector
  fetches).
- **Blocking sections:** `_ensure_event_record()` and `_persist_with_lock()` use
  synchronous `with db_session()` (and thus hold a DB connection) and call
  `repo.acquire_*_lock` / `release_*_lock`. The lock is held for the whole
  persistence phase, including **network I/O** for race fetches (by design; see
  doc 16).
- So one request can hold one DB connection for many minutes. With several
  concurrent requests per worker, connection usage adds up (see below).

---

## 3. Locking Layers

### 3.1 Next.js In-Memory Lock (`src/lib/ingestion-lock.ts`)

- **Used only by:** `POST /api/v1/events/[eventId]/ingest`.
- **Scope:** Per `eventId`; in-memory `Map` in the Next.js process.
- **Effect:** Prevents the **same** event (by DB id) from being sent to Python
  twice from the same Next.js instance. Second request gets 409 and “Event
  ingestion is already in progress”.
- **Limitations:** Not used for `POST /api/v1/events/ingest`. Per-instance only;
  multiple Next.js replicas would each have their own map (no cross-instance
  coordination).

### 3.2 Python: PostgreSQL Advisory Locks (`ingestion/db/repository.py`)

- **`acquire_source_event_lock(source_event_id)`**
  - Used in `ingest_event_by_source_id` inside `_ensure_event_record()`.
  - Prevents two requests from creating/racing on the same `source_event_id`
    (e.g. same LiveRC event).
  - Lock id: `hash("source_event:" + source_event_id) % 2^31`.

- **`acquire_event_lock(event_id)`**
  - Used in `_persist_with_lock()` for both `ingest_event` and
    `ingest_event_by_source_id`.
  - Prevents two requests from persisting the same event at once.
  - Lock id: `hash("event:" + event_id) % 2^31`.

- **Semantics:** `pg_try_advisory_lock(lock_id)` is **session-scoped**; the lock
  is held until the session ends or `pg_advisory_unlock`. So:
  - Lock is tied to the DB connection/session used in that request.
  - Lock is **global** across all workers (same lock id in any process blocks
    the other).
  - If a second request (same or different worker) tries to acquire the same
    lock, it gets `False` and the API returns `INGESTION_IN_PROGRESS` (409).

So for “multiple users at the same time”:

- **Same event / same source_event_id:** One succeeds, others get 409 (correct).
- **Different events:** Can run in parallel, limited only by number of workers
  and DB pool.

---

## 4. Database Sessions and Connection Pool Under Concurrency

### 4.1 Session Usage Per Request (Python)

Rough sequence for **ingest by source_event_id**:

1. **Route:** `get_db()` yields one session for the whole request (track lookup,
   then `await pipeline.ingest_event_by_source_id(...)`). That session is held
   until the response is sent (often minutes).
2. **Pipeline:**
   - `_ensure_event_record()`: `with db_session()` → second session, acquire
     source_event lock, create/find event, release lock, commit, close.
   - `_persist_with_lock()`: `with db_session()` → third session (same request),
     acquire event lock, run full persistence (including race fetches), release
     lock, commit, close.

So at any moment a single request can hold **up to 2** connections: the route’s
`get_db()` session and the pipeline’s `db_session()` in `_persist_with_lock`.
(The `_ensure_event_record` session is short-lived.)

### 4.2 Pool Configuration

- **Per worker:** `DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20` → 30 connections per
  worker (from `ingestion/db/session.py`).
- **All workers:** 4 × 30 = **120** possible connections from the ingestion
  service to PostgreSQL.

If each of 4 concurrent ingestions holds 2 connections, that’s 8 connections per
worker. With more concurrent requests (e.g. 10) on one worker, we could approach
or exceed 20–30 connections for that worker and see pool exhaustion or timeouts.
So **connection pool exhaustion under bursty concurrency is a real risk**,
especially if many requests land on the same worker.

---

## 5. Throttling and Backpressure

### 5.1 Next.js Rate Limit

- **Applied to:** `POST /api/v1/events/[eventId]/ingest` only (10 requests per
  minute per key).
- **Not applied to:** `POST /api/v1/events/ingest` (ingest by source_event_id).

So the “import from search” path has no API-level rate limit.

### 5.2 LiveRC Throttle (SitePolicy)

- **Config:** `policies/site_policy/policy.json` → `*.liverc.com`:
  `maxConcurrency: 8`, `crawlDelaySeconds: 0.1`.
- **Scope:** Per worker; each worker has its own `SitePolicy` and semaphore. So
  at most **8** concurrent HTTP requests to LiveRC per worker.
- **Effect:** Limits how many fetches hit LiveRC at once per worker, but does
  **not** limit how many ingestion **jobs** are started; many jobs can be “in
  progress” and block on the throttle.

---

## 6. Is There a Queue or Multiple Concurrent Processes?

- **Queue:** There is **no** job queue. Ingestions are not enqueued and
  processed by a separate worker pool; each HTTP request **is** the worker. When
  all 4 workers are busy, the 5th request waits in the ASGI/uvicorn layer until
  one worker becomes free.
- **Multiple concurrent processes:** Yes: **4 uvicorn worker processes** (by
  default). So we have “multiple concurrent processes” (4), each handling one
  long-running ingestion at a time in the steady state, and no separate queue
  process.

---

## 7. Identified Gaps and Risks

| Gap / risk                                    | Severity | Description                                                                                                                                                                                    |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No rate limit on `POST /api/v1/events/ingest` | Medium   | Bursty traffic (e.g. many users importing from search) can send many concurrent requests; only worker count and DB pool limit concurrency.                                                     |
| No global cap on concurrent ingestions        | Medium   | Beyond “4 workers,” there is no configured maximum; adding workers increases DB and LiveRC load without a cap.                                                                                 |
| Connection pool exhaustion                    | Medium   | Under many concurrent requests per worker, 2 connections per request can exhaust pool (10 + 20) and cause timeouts or 500s.                                                                    |
| Next.js lock only on one route                | Low      | For “ingest by eventId” we avoid duplicate in-flight requests per instance; for “ingest by source_event_id” we rely only on Python advisory locks (correct but different from the other path). |
| Long-held DB session in route                 | Low      | `get_db()` is held for the whole request; that connection could be returned earlier if the route did not hold it across the full pipeline.                                                     |
| No end-to-end concurrency tests               | Low      | Existing tests do not simulate multiple concurrent ingestions or lock contention; behavior is only implied by design doc 16.                                                                   |

---

## 8. Testing Performed

### 8.1 Code and Config Review

- Traced both Next.js ingest routes and confirmed which uses lock and rate
  limit.
- Confirmed Python routes, pipeline `_ensure_event_record` /
  `_persist_with_lock`, and repository `acquire_*_lock` / `release_*_lock`.
- Verified uvicorn worker and pool settings in `cron-entrypoint.sh`,
  `docker-compose.yml`, and `ingestion/db/session.py`.
- Verified SitePolicy and throttle usage in connector HTTP/Playwright clients.

### 8.2 Automated Test Added

- **File:** `ingestion/tests/unit/test_concurrent_ingestion_locks.py`
- **Purpose:** Assert that when the **source_event** advisory lock cannot be
  acquired (e.g. second concurrent request for same event), the pipeline raises
  `IngestionInProgressError` and the route returns the expected error shape.
  Uses a mock repository to simulate “lock already held” without requiring a
  real PostgreSQL.
- **How to run (in Docker):**  
  `docker exec -it mre-liverc-ingestion-service python -m pytest ingestion/tests/unit/test_concurrent_ingestion_locks.py -v`

This test does **not** run multiple real requests against Postgres; it verifies
the lock-failure path. Full end-to-end concurrency (e.g. two real requests for
the same `source_event_id` returning one 200 and one 409) would require an
integration test against a real DB and optional load test.

---

## 9. Summary Table: “What Happens When Multiple Users Ingest at Once?”

| Scenario                                                 | What happens                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Same event (same `eventId`) – existing-event endpoint    | Next.js lock blocks 2nd request → 409. Python not called twice.                                                                                 |
| Same event (same `source_event_id`) – new-event endpoint | Both reach Python. First acquires source_event lock then event lock; second fails to acquire source_event lock → `INGESTION_IN_PROGRESS` (409). |
| Different events, ≤ 4 concurrent                         | Up to 4 run in parallel (one per worker). Each uses its own advisory locks; no conflict.                                                        |
| Different events, > 4 concurrent                         | 5th and later wait for a worker to finish. No explicit queue; wait is at the uvicorn/ASGI level.                                                |
| Many concurrent (e.g. 10) on same worker                 | Possible pool exhaustion (2 conn/request); risk of 500/timeout. LiveRC throttle (8 per worker) provides some backpressure.                      |

---

## 10. Recommendations (for future work; no code changes in this diagnosis)

1. **Add rate limiting** to `POST /api/v1/events/ingest` (e.g. same or similar
   to `RATE_LIMITS.ingestion`) to cap bursty traffic from event search.
2. **Consider** returning the route’s DB session after track lookup (or not
   holding it across the pipeline) to reduce long-held connections.
3. **Consider** a global semaphore or max-concurrent-ingestions cap in the
   Python service if you want a hard limit independent of worker count.
4. **Add** an integration test that runs two concurrent requests for the same
   `source_event_id` against a real PostgreSQL and asserts one 200 and one 409
   with `INGESTION_IN_PROGRESS`.
5. **Monitor** DB connection usage and pool exhaustion (e.g. SQLAlchemy pool
   metrics or DB `max_connections`) under load.

---

## 11. Follow-up: Thread-safety fix (2026-02-04)

During re-ingestion, some races were skipped with
`InvalidRequestError: This session is provisioning a new connection; concurrent operations are not permitted`.
Cause: the pipeline runs CPU-bound work (normalization, driver matching) in a
thread pool via `asyncio.to_thread()`, but was passing **SQLAlchemy `EventEntry`
(and `Driver`) ORM objects** in the event-entries cache. Accessing
`event_entry.driver` in a worker thread triggered lazy loads on the session,
which is not thread-safe.

**Fix:** The event-entries cache passed into the thread pool is now **plain
dicts** only (`id`, `driver_id`, `source_driver_id`, `display_name`). Matching
uses `DriverMatcher.match_race_result_to_event_entry_plain()`; the main thread
resolves the matched dict back to `EventEntry` before DB writes. See **16.
Ingestion Concurrency and Locking** §3.1 (Thread Safety of Event-Entry Cache).

---

End of diagnosis report.
