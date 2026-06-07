---
created: 2026-06-02
creator: Platform / Ingestion
lastModified: 2026-06-02
description:
  Normative advisory-lock lifecycle for per-event ingestion (target state)
purpose:
  Defines how PostgreSQL advisory locks must be acquired, held, and released so
  they never leak onto pooled connections. Supersedes ambiguous sections of
  16-ingestion-concurrency-and-locking.md once remediation is implemented.
relatedDocs:
  - docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md
  - docs/implimentation_plans/ingestion-advisory-lock-remediation-2026-06.md
  - docs/adr/ADR-20260602-ingestion-advisory-lock-lifecycle.md
  - docs/reviews/ingestion-advisory-lock-investigation-2026-06-02.md
status:
  normative (target) — not yet fully implemented until plan phases complete
---

# 32. Ingestion Advisory Lock Lifecycle (Target State)

This document specifies the **required** behaviour for per-event and
source-event PostgreSQL advisory locks after remediation of leaked-lock bugs.
Implementation must match this contract; tests prove unlock on success and
failure paths.

---

## 1. Problem statement

Advisory locks are **session-scoped**. SQLAlchemy **connection pooling** reuses
backend sessions. If `pg_advisory_unlock` does not run on the **same backend
PID** that called `pg_try_advisory_lock`, the lock remains on an idle pooled
connection and all future ingests for that event receive
**`INGESTION_IN_PROGRESS`** until that connection is dropped.

---

## 2. Design principles

1. **One backend PID** for the full lock critical section: acquire → persist →
   unlock.
2. **Verified unlock** — `pg_advisory_unlock` must return `true`, or the
   connection is **invalidated** and a critical log is emitted.
3. **No silent no-op** — never assume unlock succeeded without checking the SQL
   result.
4. **Rollback before unlock** on failure — session must be in a state where
   `UNLOCK` can execute, or invalidate the connection.
5. **Locks are not timeouts** — inactivity / max-duration pipeline timeouts
   cancel work but **must still run the unlock protocol** in `finally`.
6. **Observability** — structured logs include `event_id`, `lock_id`,
   `backend_pid` on acquire and release.

---

## 3. Lock types (unchanged granularity)

| Lock key prefix            | Used for          | When                                                          |
| -------------------------- | ----------------- | ------------------------------------------------------------- |
| `event:{uuid}`             | Per MRE event row | `_persist_with_lock` for `ingest_event` / post-create persist |
| `source_event:{liverc_id}` | LiveRC source id  | `_ensure_event_record` only (short section)                   |

Lock id: `int.from_bytes(sha256(key).digest()[:8], 'big') % 2**31` (existing).

---

## 4. Event lock critical section

### 4.1 Scope

The **event lock** covers the `db_session()` block in `_persist_with_lock` only.
Connector fetches (event page, entry list, race pages) run **outside** this
block (existing design in `ingest_event`).

### 4.2 Connection pinning

At the start of `_persist_with_lock`:

1. Open `db_session()` / `Repository`.
2. **Pin** the DBAPI connection:
   `backend_pid = session.connection().connection.dbapi_connection.get_backend_pid()`.
3. `pg_try_advisory_lock(lock_id)` on that session.
4. If false → raise `IngestionInProgressError` (after optional active-job check;
   see §6).
5. Store `(lock_id, backend_pid, lock_held=True)` on a small **LockHandle**
   object passed through persist.

All `repo.session.commit()` calls during persist MUST occur on the **same**
SQLAlchemy session that pinned the PID. Do not call `session.invalidate()` until
after successful unlock or intentional connection sacrifice.

### 4.3 Release (success or failure)

In a `finally` block (always runs):

1. If not `lock_held`, skip.
2. `session.rollback()` if session is in failed state
   (`session.in_transaction()` / `session.get_transaction()` per SQLAlchemy 2
   patterns).
3. Execute `SELECT pg_advisory_unlock(:lock_id)`; read boolean **`released`**.
4. If `released` is false:
   - Log `advisory_lock_release_failed` with `event_id`, `lock_id`,
     `acquire_pid`, `release_pid` (current backend PID).
   - `session.invalidate()` to drop the pooled connection and clear session
     locks.
   - Increment metric `ingestion_advisory_lock_release_failures_total`.
5. If `released` is true:
   - Log `advisory_lock_released` at debug/info.

Then allow `db_session` context manager to commit (no-op if already committed)
and `close()`.

### 4.4 Constraint-violation retry

Existing race-condition retry may call `ingest_event` again. Retry path MUST:

- Use the **verified unlock** helper (not raw `release_event_lock` without
  check).
- Set `lock_held = False` only after `released == true` OR after `invalidate()`.

---

## 5. Source-event lock

`_ensure_event_record` keeps a **short** `db_session()`:

- Acquire `source_event:{id}` → upsert or read → unlock in `finally` using the
  **same verified unlock helper** as event locks.
- Do not hold source lock while calling `_persist_with_lock`.

---

## 6. Interaction with ingestion queue

When `pg_try_advisory_lock` returns false:

1. If `get_active_job_for_event_id(event_id)` returns a job in `queued` or
   `running` → treat as **legitimate conflict** (another worker owns work).
2. If **no** active in-process job → classify as
   **`advisory_lock_leaked_suspected`** (log critical, metric increment). API
   may still return 409, but operators use
   [ingestion-lock-recovery-runbook.md](../../operations/ingestion-lock-recovery-runbook.md).

Optional later: CLI `ingest liverc release-event-lock --event-id …` for
controlled recovery (plan Phase 4 optional).

---

## 7. API / HTTP semantics (target)

| Condition                                          | HTTP    | Body                                                             |
| -------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| Lock acquired, queue enabled                       | 202     | `{ job_id, status: "queued" }`                                   |
| Active job exists (deduped)                        | 202     | same `job_id`                                                    |
| Lock held by live worker (lock false + active job) | 202     | existing job or conflict message                                 |
| Lock false, no active job (leaked / unknown)       | 409     | `INGESTION_IN_PROGRESS` + `details.hint: "stale_lock_suspected"` |
| Sync ingest (`INGESTION_USE_QUEUE=false`)          | 200/4xx | same rules without queue                                         |

Next.js `ingestion-lock.ts` remains a **best-effort** duplicate guard only;
document as non-authoritative for cross-process locking.

---

## 8. Timeouts (clarified)

| Mechanism                             | Behaviour                         | Lock                              |
| ------------------------------------- | --------------------------------- | --------------------------------- |
| `INACTIVITY_TIMEOUT_SECONDS` (5 min)  | Cancels persist coroutine         | **Must** still run §4.3 `finally` |
| `MAX_TOTAL_DURATION_SECONDS` (1 hour) | Hard stop                         | **Must** still run §4.3 `finally` |
| PostgreSQL                            | No automatic advisory lock expiry | N/A                               |

Update
[16-ingestion-concurrency-and-locking.md](./16-ingestion-concurrency-and-locking.md)
§5.2 when implementation ships.

---

## 9. Testing requirements

See implementation plan § “Test matrix”. Minimum:

- Unit: unlock helper returns false → `invalidate` called (mock connection).
- Integration (Postgres): acquire → multiple commits → unlock → second acquire
  succeeds.
- Integration: acquire → simulate flush error → finally unlock → second acquire
  succeeds.
- Regression: two sequential ingests on same event from pool do not leave
  `pg_locks` advisory rows after completion.

All tests run in Docker: `docker exec mre-liverc-ingestion-service pytest …`

---

## 10. Recovery

Operational recovery is documented in
[ingestion-lock-recovery-runbook.md](../../operations/ingestion-lock-recovery-runbook.md).
Code fixes reduce need for manual intervention; they do not replace it until
proven stable in production.
