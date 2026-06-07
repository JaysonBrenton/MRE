---
created: 2026-06-02
owner: Platform / Operations
lastModified: 2026-06-02
description: Recover from stuck per-event ingestion advisory locks
purpose:
  Operational steps when users see INGESTION_IN_PROGRESS but no import is
  running. Use after code remediation is deployed to reduce incidence; still
  required when leaks or crashed workers occur.
relatedDocs:
  - docs/reviews/ingestion-advisory-lock-investigation-2026-06-02.md
  - docs/architecture/liverc-ingestion/32-ingestion-advisory-lock-lifecycle.md
  - docs/implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md
  - docs/architecture/liverc-ingestion/21-ingestion-recovery-procedures.md
---

# Runbook: Stuck ingestion advisory locks

## Symptoms

- UI refresh or import returns **“Ingestion already in progress”** /
  `409 INGESTION_IN_PROGRESS`.
- Ingestion job queue shows **no** `queued` or `running` job for that event (or
  job already `failed` with that message).
- CLI fails immediately:

  ```text
  Ingestion failed: Ingestion already in progress for event <uuid>
  ```

- Problem may persist for **hours** after a previously “successful” import.

## Quick diagnosis

All commands assume repo root and Docker Desktop running (`desktop-linux`
context).

### 1. Check ingestion container

```bash
docker ps --filter name=mre-liverc-ingestion-service
```

### 2. Check for active queued job (in-process queue)

```bash
docker exec mre-liverc-ingestion-service python -c "
from ingestion.api import job_queue
eid = '<EVENT_UUID>'
job = job_queue.get_active_job_for_event_id(eid)
print('active_job', job.job_id if job else None, job.status if job else None)
"
```

If a job is `queued` or `running`, **wait** or monitor:

```bash
docker exec mre-liverc-ingestion-service python -c "
from ingestion.api.job_queue import get_job
print(get_job('<JOB_ID>').to_response())
"
```

### 3. Check PostgreSQL advisory locks

```bash
docker exec mre-postgres psql -U pacetracer -d pacetracer -c "
SELECT l.pid, l.objid AS lock_id, l.mode, a.state, a.backend_start,
       left(a.query, 80) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory'
ORDER BY l.pid;
"
```

Compute expected lock id for an event (optional):

```bash
docker exec mre-liverc-ingestion-service python -c "
import hashlib
key = 'event:<EVENT_UUID>'
h = hashlib.sha256(key.encode()).digest()
print(int.from_bytes(h[:8], 'big') % (2**31))
"
```

After Phase 1 of the remediation plan, prefer
`ingestion.db.advisory_lock.compute_lock_id`.

If advisory locks exist for a long time on an **idle** session with no running
job → **stale leak** (see recovery below).

### 4. Recent logs

```bash
docker logs mre-liverc-ingestion-service 2>&1 | rg "Ingestion already in progress|lock_release|advisory_lock" | tail -30
```

## Recovery procedures

### A. Recommended: restart ingestion service (safest)

Drops pooled connections and clears all session advisory locks on those
connections.

```bash
docker compose restart mre-liverc-ingestion-service
```

Re-try import/refresh. Does not affect `mre-app` or Postgres data.

### B. Terminate stuck Postgres backend (surgical)

Use when you identify a specific `pid` from step 3 and want to avoid restarting
the whole service.

```bash
docker exec mre-postgres psql -U pacetracer -d pacetracer -c "SELECT pg_terminate_backend(<PID>);"
```

Verify:

```bash
docker exec mre-postgres psql -U pacetracer -d pacetracer -c \
  "SELECT COUNT(*) FROM pg_locks WHERE locktype='advisory';"
```

**Warning:** Terminating a backend aborts any transaction on that connection.
Only use when that session is **idle** and not actively ingesting another event.

### C. Full stack restart (last resort)

```bash
docker compose restart
```

## What does **not** fix Postgres advisory locks

| Action                                          | Why                                                         |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `pg_advisory_unlock` from a **new** SQL session | Locks are held by another backend PID                       |
| Re-running ingest immediately                   | Will fail again until lock holder is disconnected           |
| Only restarting `mre-app`                       | Next.js in-memory lock clears; **Postgres** lock may remain |

## Legitimate “already in progress” (no recovery needed)

- Queue shows `running` job with recent `pipeline_stage` updates.
- User triggered import twice during a long ingest (large events can take
  several minutes).
- Cron `refresh-recent-events` and manual refresh overlap on the same event.

Wait for job completion or poll `GET /api/v1/ingestion/jobs/{job_id}` via
ingestion service.

## Prevention (after remediation deploy)

Code changes in
[ingestion-advisory-lock-remediation-2026-06.md](../implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md)
should:

- Verify `pg_advisory_unlock` and invalidate connections on failure.
- Pin the acquiring connection for the persist phase.

Monitor:

- `ingestion_advisory_lock_release_failures_total`
- `ingestion_advisory_lock_leaked_suspected_total`
- Log events `advisory_lock_release_failed`, `advisory_lock_leaked_suspected`

## Escalation

If locks reappear after remediation:

1. Capture `pg_locks` + `pg_stat_activity` output.
2. Export last 500 lines of `mre-liverc-ingestion-service` logs around last
   successful `ingestion_job_completed` for that `event_id`.
3. File issue with event UUID, lock_id, and pid list.

## Related user-facing copy

After Phase 4 UI work, `stale_lock_suspected` should point users to retry after
service restart or contact admin. Until then, operators use this runbook.
