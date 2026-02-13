---
created: 2026-02-04
description: Asynchronous ingestion via in-process job queue and status polling
purpose:
  Describes the async ingestion flow: enqueue on POST, return 202 with job_id,
  background workers, status endpoint with optional queue position, and
  frontend polling. Complements doc 16 (concurrency and locking).
relatedDocs:
  - docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/reviews/ingestion-concurrency-diagnosis-2026-02-04.md
---

# 28. Async Ingestion Queue

When `INGESTION_USE_QUEUE` is enabled (default), the ingestion service does not run the pipeline synchronously in the HTTP request. Instead it enqueues a job, returns **202 Accepted** with a **job_id**, and processes the job in background worker(s). Clients poll a status endpoint until the job completes or fails.

## 1. Why Async

- **Non-blocking UX:** The client gets an immediate response and can show "Queued" / "In progress" / "Position in queue" instead of a long-running request.
- **Load management:** A bounded number of workers process jobs (e.g. 2 concurrent ingestions via `INGESTION_QUEUE_MAX_CONCURRENT`); extra requests wait in the queue instead of holding HTTP connections.
- **Resilience:** Failed jobs can be inspected via status (and in future, retried or dead-lettered).

## 2. Architecture (In-Process)

- **Queue:** In-process `asyncio.Queue` and in-memory job store in the Python service (`ingestion/api/job_queue.py`). Workers and job state live inside the same process (no Redis/Celery). Completed/failed jobs are automatically evicted after a retention period so polling performance stays O(number of queued jobs).
- **Constraint:** When the queue is enabled, **exactly one Uvicorn worker** is required (`UVICORN_WORKERS=1`) so that job status and queue state live in the same process; otherwise polling may hit a different worker and get 404.
- **Workers:** Background asyncio tasks started on app startup. The number of workers is derived from `INGESTION_QUEUE_MAX_CONCURRENT` (default 2) so we actually process multiple jobs in parallel while still respecting the semaphore limit.

## 3. API Behaviour

| Scenario | Response |
|----------|----------|
| Queue enabled, POST ingest | **202 Accepted** with `{ "success": true, "data": { "job_id": "<uuid>", "status": "queued" } }` |
| Queue disabled | **200 OK** with full ingestion result (synchronous). |
| GET `/api/v1/ingestion/jobs/{job_id}` | **200** with `status` (`queued` \| `running` \| `completed` \| `failed`), `created_at`, `updated_at`; when `queued`, optional `queue_position` (1-based); when `completed`, `result`; when `failed`, `error_code`, `error_message`. **404** if job unknown. |

## 4. Frontend

- **Event search:** When the ingest API returns 202 with `job_id`, the client polls `GET /api/v1/ingestion/jobs/{job_id}` (via Next.js proxy) until `status` is `completed` or `failed`, then updates UI or shows error.
- **Dashboard (my-event):** The "Refresh event data" action does the same: on 202 + `job_id`, it polls the job status until completion, then refreshes the page and shows the success modal (or error).

Next.js API routes (`/api/v1/events/[eventId]/ingest`, `/api/v1/events/ingest`) proxy to the Python service and return 202 with `job_id` when the Python service returns 202; they do not block until the job completes. The UI is responsible for polling the job status endpoint.

## 5. Configuration (Environment)

- `INGESTION_USE_QUEUE` — `true` (default) or `false`. When `false`, ingest runs synchronously and returns 200 with the result.
- `INGESTION_QUEUE_MAX_CONCURRENT` — max concurrent ingestion jobs (default `2`). Also controls how many worker tasks are spawned.
- `INGESTION_QUEUE_JOB_TTL_SECONDS` — retention window for completed/failed job metadata before eviction (default `3600`).
- `UVICORN_WORKERS` — must be `1` when the queue is enabled so job status is visible to all requests.

## 6. Future Options

- **Redis/Celery (or RQ):** For multi-worker or multi-node setups, job state would need to live in Redis (or similar) so any worker can serve status and any node can run workers.
- **Pipeline progress:** The pipeline could report progress (e.g. "Fetching race 3/10") into the job record so the status endpoint can return a `progress` or `stage` field for better UX.
