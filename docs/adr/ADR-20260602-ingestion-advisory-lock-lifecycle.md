---
created: 2026-06-02
status: Proposed
deciders: Engineering, Platform
---

# ADR-20260602 — Pin and verify PostgreSQL advisory locks for event ingestion

## Context

Per-event ingestion uses PostgreSQL `pg_try_advisory_lock` to prevent concurrent
writes for the same `event_id`. Locks are **session-scoped**; the ingestion
service uses SQLAlchemy **connection pooling** with many `session.commit()`
calls during a single persist phase that can last minutes.

Investigation (2026-06-02) confirmed **false** `INGESTION_IN_PROGRESS` errors:
completed jobs left advisory locks on **idle pooled connections** for hours,
blocking refresh and CLI re-ingest until the backend was terminated. See
[ingestion-advisory-lock-investigation-2026-06-02.md](../reviews/ingestion-advisory-lock-investigation-2026-06-02.md).

Existing `_release_event_lock_safely` mitigates unlock failures after
`PendingRollbackError` but does not verify unlock success on the happy path and
does not pin the acquiring backend PID.

## Decision

1. Introduce a single **advisory lock helper module** (e.g.
   `ingestion/db/advisory_lock.py`) used by `Repository` and `IngestionPipeline`
   that:
   - Records **backend PID** at acquire time.
   - On release, runs `pg_advisory_unlock` and requires result **`true`**.
   - On failure, logs at **critical**, increments Prometheus counter, and calls
     `session.invalidate()` on the pinned session.

2. **Pin one SQLAlchemy session / DBAPI connection** for the full
   `_persist_with_lock` critical section (acquire → `_persist_event_data` →
   unlock in `finally`). Do not release the event lock until verified unlock or
   connection invalidation.

3. Apply the same verified unlock pattern to **source-event** locks in
   `_ensure_event_record`.

4. When lock acquisition fails, distinguish:
   - **Active in-process job** (queue) → return existing `job_id` / 202 where
     applicable.
   - **No active job** → log `advisory_lock_leaked_suspected`; operators follow
     [ingestion-lock-recovery-runbook.md](../operations/ingestion-lock-recovery-runbook.md).

5. **Normative specification:**
   [32-ingestion-advisory-lock-lifecycle.md](../architecture/liverc-ingestion/32-ingestion-advisory-lock-lifecycle.md).

6. **Implementation plan:**
   [ingestion-advisory-lock-remediation-2026-06.md](../implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md).

## Alternatives considered

| Alternative                               | Rejected because                                                    |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Redis distributed lock                    | Extra infra; does not fix leaked PG locks on pool; two lock systems |
| Row-level `SELECT FOR UPDATE` on `events` | Holds row locks across long network I/O; worse contention           |
| `NullPool` (no pooling)                   | Hurts throughput; does not fix wrong-session unlock                 |
| Ignore unlock return value                | Current bug; proven in production                                   |
| Only document restart workaround          | Poor UX; cron + users hit same events repeatedly                    |

## Consequences

**Positive**

- Eliminates stale `INGESTION_IN_PROGRESS` after successful ingests.
- Clear logs/metrics for genuine overlap vs leak.
- Aligns architecture doc with actual timeout behaviour.

**Negative / trade-offs**

- Slightly more code in hot path (PID logging, boolean check).
- `session.invalidate()` under failure may discard a pool connection
  (acceptable).
- Must add integration tests requiring Postgres in CI/Docker.

**Risks**

- Regression if unlock helper not used on all exit paths — mitigated by
  checklist in implementation plan and single helper API.

## Compliance

- Docker-only testing per [AGENTS.md](../AGENTS.md).
- No change to LiveRC scraping policy or ingest depth semantics.
- Next.js in-memory lock unchanged in v1 (optional consolidation later).
