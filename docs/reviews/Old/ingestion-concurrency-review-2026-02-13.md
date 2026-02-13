# Python Ingestion Concurrency & Queueing Review

**Date:** 2026-02-13 (UTC) **Scope:** Full review of the Python ingestion
services with emphasis on concurrency controls, background queueing, and
opportunities for throughput/performance improvements.

## Executive Summary

- The in-process async job queue currently processes **one job at a time**
  despite exposing `INGESTION_QUEUE_MAX_CONCURRENT`, so bursts simply accumulate
  in memory and wait.
- Job state is kept forever in a process-local dict with no TTL or durability,
  so polling cost grows linearly and all queued work disappears on restart or on
  multi-replica deployments.
- The pipeline’s adaptive race-fetch concurrency logic never affects the current
  ingestion run, meaning we always fetch eight races at a time regardless of
  latency or rate-limit feedback.
- Long-lived advisory locks and SQLAlchemy sessions span network I/O, so each
  ingestion job can monopolize a DB connection for minutes; this becomes a
  bottleneck once we enable more than one queue worker.
- Supporting services (track sync and practice discovery) fire off large numbers
  of tasks sequentially or all at once without backpressure, leaving obvious
  room for safer concurrency primitives.

## Detailed Findings

### 1. Queue workers ignore `INGESTION_QUEUE_MAX_CONCURRENT`

- `startup_event` always calls `start_workers(num_workers=1)`
  (ingestion/api/app.py:127-135) and each worker awaits `_run_job` before
  reading the next queue item (ingestion/api/job_queue.py:184-195).
- Even though a semaphore is created from `INGESTION_QUEUE_MAX_CONCURRENT`
  (ingestion/api/job_queue.py:91-93), it never gates concurrency because there
  is only one worker coroutine.
- Docker entrypoint forces `UVICORN_WORKERS=1` when the queue is enabled
  (ingestion/scripts/cron-entrypoint.sh:60-66), so a single process handles
  every ingestion request sequentially.
- **Impact:** Queue mode degrades to FIFO serial execution; bursts of imports
  tie up minutes of work per job with no way to exploit safe parallelism.
- **Opportunities:** Spawn `num_workers = max(1, _max_concurrent)` so multiple
  workers can drain the queue while the semaphore still caps concurrency. Add
  metrics for queue depth and worker utilization so we can size the pool
  deliberately.

### 2. Unbounded, process-local job store and O(n) polling

- Jobs are inserted into `_job_store` and `_queue` but are never evicted
  (ingestion/api/job_queue.py:88-135). `queue_position_for_job` sorts the entire
  dict on every poll (ingestion/api/job_queue.py:124-135).
- Because the store is in-memory, a pod restart loses all queued/completed job
  state, and multiple pods would each expose their own isolated queue even
  though the API advertises a single job ID space.
- **Impact:** Memory consumption grows for every ingestion ever enqueued, status
  polling slows to O(n) per request, and users see 404/not found whenever a
  worker restarts.
- **Opportunities:** Introduce TTL/cleanup for completed/failed jobs, retain
  only the last N finished jobs, and move queue state into a shared store
  (Redis, Postgres, or at least SQLite) before running multiple pods. Consider
  deduplicating by `event_id`/`source_event_id` so that repeat clicks simply
  return the existing job.

### 3. Adaptive race-fetch concurrency never takes effect

- `_adjust_concurrency` mutates `self.RACE_FETCH_CONCURRENCY` based on latencies
  (ingestion/ingestion/pipeline.py:364-411), but `_process_races_parallel`
  copies that value into `batch_size` once before iterating
  (ingestion/ingestion/pipeline.py:964).
- Pipeline instances are created per request/job
  (ingestion/api/routes.py:526-529, ingestion/api/job_queue.py:138-159), so any
  adjustment made mid-run is discarded when the object goes out of scope.
- **Impact:** We always fetch eight races in parallel regardless of observed
  latency or rate limiting, so the adaptive logic is effectively dead code and
  we cannot throttle under duress.
- **Opportunities:** Recompute `batch_size` at the beginning of each batch or
  slice `race_summaries` using the current `self.RACE_FETCH_CONCURRENCY`.
  Alternatively, keep the concurrency knobs on a shared object so jobs benefit
  from previous runs.

### 4. DB connections and advisory locks span the entire ingestion

- `_persist_with_lock` acquires `pg_try_advisory_lock` and keeps the same
  SQLAlchemy session open for the full ingestion
  (ingestion/ingestion/pipeline.py:1382-1444). `_persist_event_data` then
  performs race fetching, CPU processing, and multiple commits while that
  session remains checked out (ingestion/ingestion/pipeline.py:1495-1531).
- `db_session()` uses a pool size of 10 and max overflow of 20 per process
  (ingestion/db/session.py:60-118). With only one queue worker this is
  acceptable, but as soon as we allow two concurrent ingestions we can pin two
  long-lived connections plus everything the API layer opens (e.g., unused `db`
  dependencies).
- **Impact:** Concurrency is effectively bounded by DB pool size rather than
  queue settings, and lock hold times include network I/O, exacerbating
  contention.
- **Opportunities:** Narrow lock scope by fetching and processing races before
  acquiring the event-level advisory lock, or at least perform race fetching
  with a separate short-lived session so the write session can be returned to
  the pool. Consider storing the advisory lock in a dedicated connection so we
  are not forced to keep an ORM session open for the duration.

### 5. API dependency opens unused DB sessions

- `POST /events/{event_id}/ingest` injects `db: Session = Depends(get_db)` but
  never uses it (ingestion/api/routes.py:500-535). Even in queue mode, every
  HTTP request opens and closes a DB connection purely for dependency wiring.
- **Impact:** When the UI polls or enqueues many jobs we churn through the
  shared connection pool for no benefit, shortening the headroom available to
  worker jobs.
- **Opportunities:** Remove the unused dependency or lazily request a session
  only on the synchronous path. For the queue-enabled path, validate inputs
  without touching the DB whenever possible.

### 6. Track sync metadata fetch spawns one task per track

- `_fetch_metadata` creates a coroutine for every track and then runs them all
  via `asyncio.gather` (ingestion/services/track_sync_service.py:253-330). The
  semaphore prevents too many concurrent HTTP calls, but scheduling thousands of
  tasks at once consumes memory and prevents backpressure or cancellation.
- **Impact:** Large track lists lead to high RAM usage and slow cancellation
  response, and we cannot inspect queue depth or short-circuit when shutting
  down.
- **Opportunities:** Replace `gather(*(worker(...) for ...))` with a
  producer/consumer queue or `asyncio.Semaphore` guarded worker pool that only
  spawns `metadata_concurrency` tasks at a time. Emit metrics for backlog length
  so we can monitor stall conditions.

### 7. Practice day discovery performs serial network I/O

- Both the month-view loop and the fallback weekend probing fetch one date at a
  time (ingestion/services/practice_day_discovery.py:79-210). The fallback can
  wait up to 8 seconds per day and only checks 30 days sequentially.
- **Impact:** A single discovery call can block for several minutes even though
  each date lookup is independent, making concurrent discovery impractical under
  queue mode.
- **Opportunities:** Batch day-level requests using `asyncio.gather` with a
  small semaphore (e.g., 3–4 concurrent fetches) so slow days do not stall the
  entire job. Cache negative results per date to avoid repeated lookups.

### 8. Job queue durability and telemetry gaps

- The queue is in-process with no persistence
  (ingestion/api/job_queue.py:88-117); a restart loses everything and polling
  clients receive 404 (ingestion/api/routes.py:486-497). There is no queue
  length metric or max-size guard, so we cannot apply backpressure.
- Only one unit test exists for the queue and it merely asserts that two job IDs
  remain visible in memory
  (ingestion/tests/unit/test_job_queue_concurrent_visibility.py:1-40). There is
  no coverage for worker concurrency, job cleanup, or failure states.
- **Impact:** Operational visibility is poor and we cannot validate concurrency
  changes safely; the queue silently drops work on restart.
- **Opportunities:** Track queue depth/oldest job age in metrics, add optional
  TTL for finished jobs, and expand automated tests to include multi-job
  execution, failure retries, and queue overflow scenarios.

### 9. Host throttling is per-process only

- `SitePolicy.shared()` caches a singleton per Python process
  (ingestion/common/site_policy.py:70-120). When the queue is disabled and
  uvicorn launches multiple workers
  (ingestion/scripts/cron-entrypoint.sh:65-100), each process enforces its own
  crawl-delay semaphore.
- **Impact:** LiveRC host limits are effectively multiplied by the number of
  workers/pods, so we can unintentionally exceed contractual throttles when
  scaling horizontally.
- **Opportunities:** Externalize throttling state (Redis or shared advisory
  lock) or reduce `UVICORN_WORKERS` when queue mode is off so the host-level
  semaphore actually limits global concurrency.

### 10. Queue position lookups scale poorly

- Every status poll sorts the entire `_job_store` to compute the 1-based queue
  position (ingestion/api/job_queue.py:124-135). Combined with the lack of
  cleanup, latency for `/ingestion/jobs/{job_id}` grows with every historical
  job.
- **Impact:** Polling becomes a bottleneck well before ingestion throughput
  improves, especially when many UI clients poll simultaneously.
- **Opportunities:** Maintain a separate deque of queued job IDs so queue
  position lookups are O(1), or store the position on enqueue and update it when
  dequeuing.

---

## Post-remediation Review (2026-02-13)

### Queue concurrency, retention, and queue-position performance

- `start_workers()` now spawns as many workers as
  `INGESTION_QUEUE_MAX_CONCURRENT` and guarantees the function is idempotent, so
  queue mode finally respects the configured parallelism
  (`ingestion/api/job_queue.py:187-220`).
- A dedicated deque tracks queued job IDs, and completed/failed jobs are pruned
  via `INGESTION_QUEUE_JOB_TTL_SECONDS`, which keeps memory bounded and makes
  queue-position lookups proportional to queued jobs only
  (`ingestion/api/job_queue.py:88-181`).
- Architecture doc 28 reflects the new retention knob and worker model
  (`docs/architecture/liverc-ingestion/28-async-ingestion-queue.md`).

### Adaptive race-fetch concurrency

- `_process_races_parallel()` re-evaluates `RACE_FETCH_CONCURRENCY` before each
  batch so adjustments made by `_adjust_concurrency()` immediately affect the
  current run. The batching loop no longer precomputes fixed slices
  (`ingestion/ingestion/pipeline.py:960-1040`).

### DB usage and API plumbing

- The ingest-by-event route stops opening an unused SQLAlchemy session, freeing
  a connection slot per request (`ingestion/api/routes.py:500-535`).

### Supporting service concurrency

- Track metadata sync uses a bounded worker queue instead of spawning one task
  per track, preventing unbounded task lists while retaining the same
  concurrency cap (`ingestion/services/track_sync_service.py:253-330`).
- Practice-day fallback discovery now probes up to 30 dates concurrently (with a
  semaphore) instead of sequential 8-second waits, so long ranges finish in
  seconds even when month view is empty
  (`ingestion/services/practice_day_discovery.py:130-210`).

### Operational readiness and tests

- Metrics fall back to lightweight no-op collectors when `prometheus_client` is
  missing so unit tests no longer require compiled extensions
  (`ingestion/common/metrics.py:8-33`).
- New unit tests exercise the queue-order bookkeeping and TTL cleanup
  (`ingestion/tests/unit/test_job_queue_store.py`).
- Existing job-visibility tests still pass under the multi-worker queue
  (`ingestion/tests/unit/test_job_queue_concurrent_visibility.py`).

### Remaining considerations

- Advisory locks still rely on a session-scoped connection. When raising
  `INGESTION_QUEUE_MAX_CONCURRENT`, monitor the Postgres pool (10 + 20 overflow)
  to ensure capacity for API traffic.
- The queue remains in-process; running multiple Uvicorn workers would still
  fragment job state. Scaling horizontally will require an external store
  (Redis/Postgres) as documented in section 28.

## Suggested Next Steps

1. Decide on the desired parallelism for ingestion jobs and update
   `start_workers()` to honor `INGESTION_QUEUE_MAX_CONCURRENT`. Instrument queue
   depth/work rate.
2. Add retention/persistence for job state plus dedupe logic so repeat clicks
   reuse the existing job. Consider Redis/RQ if we need multi-pod deployments.
3. Fix the adaptive concurrency bug by applying the updated
   `RACE_FETCH_CONCURRENCY` during the same ingestion run, then tune the
   thresholds based on real latency metrics.
4. Shorten DB lock scopes: fetch races outside the write transaction or split
   read/write sessions so adding more workers does not overwhelm the pool.
5. Prune unused DB dependencies in FastAPI routes and audit other endpoints for
   similar issues.
6. Rework supporting services (track sync, practice discovery) to use bounded
   worker pools instead of “spawn all tasks” or “serial loop” patterns.
7. Expand automated tests to cover queue concurrency, job cleanup, and failure
   handling so we can refactor safely.
8. Evaluate whether `SitePolicy` needs shared state across workers/pods or
   simply lower worker counts to stay within LiveRC limits.
