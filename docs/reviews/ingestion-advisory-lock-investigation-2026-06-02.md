---
created: 2026-06-02
author: Ingestion lock investigation (LLM-assisted)
status: findings — drives remediation docs
purpose:
  Records confirmed root cause and evidence for false INGESTION_IN_PROGRESS
  errors. Implementation work is specified in the linked plan and architecture
  doc; this file is the audit trail.
relatedDocs:
  - docs/reviews/liverc-ingestion-service-bug-review-2026-06-02.md
  - docs/implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md
  - docs/architecture/liverc-ingestion/32-ingestion-advisory-lock-lifecycle.md
  - docs/adr/ADR-20260602-ingestion-advisory-lock-lifecycle.md
  - docs/operations/ingestion-lock-recovery-runbook.md
---

# Investigation: False `INGESTION_IN_PROGRESS` (Advisory Lock Leak)

## Summary

Users often see **“Ingestion already in progress”** when refreshing or importing
an event, even when no import appears to be running. Investigation confirms a
**real bug**: PostgreSQL **session advisory locks** can remain on **idle pooled
connections** after ingestion jobs **complete successfully**. Later requests
then fail `pg_try_advisory_lock` and raise `IngestionInProgressError` until the
stuck connection is terminated or the ingestion container is restarted.

This is distinct from (but often confused with) **legitimate** overlap when two
imports actually run at once.

---

## Evidence (2026-06-02, live Docker / Postgres)

| Observation                       | Detail                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Stuck backend                     | `pg_stat_activity` pid **171**, state **idle**, last query `COMMIT`                                            |
| Locks held                        | **3** advisory exclusive locks on that single connection                                                       |
| Mapped events                     | `152528b7…`, `9a89f007…`, `f887c621…` — each had `ingestion_job_completed` in logs                             |
| Reproduce block                   | New session: `acquire_event_lock(152528b7…)` → **false**                                                       |
| After `pg_terminate_backend(171)` | New session: acquire → **true**                                                                                |
| CLI failure                       | `ingest-event --force` for `152528b7…` failed with `Ingestion already in progress` while jobs were not running |

Lock IDs are deterministic: `SHA256("event:{uuid}")[:8] mod 2^31` (see
`Repository._compute_lock_id`).

---

## Root cause (mechanism)

1. Ingestion uses **`pg_try_advisory_lock`** per event for the persist phase
   (`pipeline._persist_with_lock`).
2. Advisory locks are **connection-scoped**, not transaction-scoped — they
   survive `COMMIT` and are released only by **`pg_advisory_unlock`** on the
   **same** backend session or by **disconnecting** that session.
3. `release_event_lock` runs `pg_advisory_unlock` but **does not check** the SQL
   boolean result. If unlock runs on a **different** backend PID than the one
   that acquired the lock, unlock is a no-op and the lock stays on the pooled
   connection.
4. `_persist_event_data` calls **`repo.session.commit()`** many times while the
   same `db_session()` context stays open for minutes (race fetches + writes).
   SQLAlchemy can associate the session with different pool checkouts over time;
   the team already added `_release_event_lock_safely` after a prior incident,
   but leaks still occur on the **success path** without `lock_release_*` logs.
5. On **DB errors** (e.g. `UniqueViolation` during qual-points bulk insert),
   `PendingRollbackError` during `finally` can prevent unlock; logs show
   `lock_release_failed` followed sometimes by
   `lock_release_recovered_after_rollback`, with **subsequent** jobs still
   failing for the same event — consistent with a lock left on **another**
   pooled connection.

---

## Legitimate `INGESTION_IN_PROGRESS` (not a leak)

| Scenario               | Why                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Overlapping imports    | Queue `INGESTION_QUEUE_MAX_CONCURRENT=2`; cron + UI + CLI on same event                                |
| Fetch-before-lock      | Event page + entry list fetched **before** lock; second request waits then loses at `await_event_lock` |
| CLI while worker runs  | CLI bypasses queue; synchronous `ingest_event` races queued worker                                     |
| Next.js in-memory lock | `src/lib/ingestion-lock.ts` — 5 min per `mre-app` instance (separate from Postgres)                    |

---

## Two lock layers (user-visible)

| Layer    | Location                                              | Symptom                                             |
| -------- | ----------------------------------------------------- | --------------------------------------------------- |
| Next.js  | `tryAcquireLock` in `/api/v1/events/[eventId]/ingest` | 409 `INGESTION_IN_PROGRESS` before Python is called |
| Postgres | `Repository.acquire_event_lock`                       | 409 from ingestion service / failed queued job      |

---

## Documentation drift

`docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md`
§5.2 states a **5-minute `asyncio.wait_for` lock timeout** that **releases the
lock**. Implementation uses **inactivity** and **max duration** monitors
(`INACTIVITY_TIMEOUT_SECONDS`, `MAX_TOTAL_DURATION_SECONDS`) but does **not**
release PostgreSQL advisory locks automatically on timeout. Remediation includes
doc corrections (see implementation plan Phase 5).

---

## Recommended fixes (implementation package)

Tracked in:

- **Plan:**
  [ingestion-advisory-lock-remediation-2026-06.md](../implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md)
- **Target design:**
  [32-ingestion-advisory-lock-lifecycle.md](../architecture/liverc-ingestion/32-ingestion-advisory-lock-lifecycle.md)
- **ADR:**
  [ADR-20260602-ingestion-advisory-lock-lifecycle.md](../adr/ADR-20260602-ingestion-advisory-lock-lifecycle.md)
- **Ops:**
  [ingestion-lock-recovery-runbook.md](../operations/ingestion-lock-recovery-runbook.md)

1. Verified unlock + connection invalidation on failure
2. Pinned connection for lock acquire → persist → unlock
3. Rollback-then-unlock on all persist failure paths
4. API/UX: distinguish active job vs leaked lock (202 + job id vs 409)
5. Doc + runbook alignment

---

## Log signals (container `mre-liverc-ingestion-service`)

| Event                                                    | Meaning                                               |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `ingestion_job_failed` + `Ingestion already in progress` | Lock not acquired at `_persist_with_lock`             |
| `lock_release_failed`                                    | Unlock attempted on aborted session                   |
| `lock_release_recovered_after_rollback`                  | Unlock after rollback (verify with follow-up acquire) |
| `lock_release_retry_failed_connection_invalidated`       | Critical — pool connection may still hold lock        |
| _(none)_ on success path today                           | No positive confirmation unlock succeeded             |

Proposed new events (implementation): `advisory_lock_acquired`,
`advisory_lock_released`, `advisory_lock_release_failed`,
`advisory_lock_leaked_suspected`.
