---
created: 2026-06-02
owner: Platform / Ingestion
lastModified: 2026-06-02
purpose:
  Phased implementation plan to fix leaked PostgreSQL advisory locks and improve
  INGESTION_IN_PROGRESS UX. Implements ADR-20260602 and architecture doc 32.
relatedDocs:
  - docs/adr/ADR-20260602-ingestion-advisory-lock-lifecycle.md
  - docs/architecture/liverc-ingestion/32-ingestion-advisory-lock-lifecycle.md
  - docs/reviews/ingestion-advisory-lock-investigation-2026-06-02.md
  - docs/operations/ingestion-lock-recovery-runbook.md
  - docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - docs/AGENTS.md
status: Planned — documentation only until phases are implemented in code
---

# Ingestion Advisory Lock Remediation — Implementation Plan (June 2026)

Implements
[ADR-20260602](../adr/ADR-20260602-ingestion-advisory-lock-lifecycle.md) and
[32-ingestion-advisory-lock-lifecycle.md](../architecture/liverc-ingestion/32-ingestion-advisory-lock-lifecycle.md).

All commands are **Docker-only** per [AGENTS.md](../AGENTS.md).

---

## Goals

| #   | Goal                                             | Success criterion                                                            |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| G1  | No leaked advisory locks after successful ingest | `pg_locks` advisory count 0 for event after job completes (integration test) |
| G2  | No leaked locks after failed ingest              | Same after forced `UniqueViolation` / rollback path                          |
| G3  | Verified unlock                                  | `pg_advisory_unlock` false triggers invalidate + critical log                |
| G4  | Clear operator recovery                          | Runbook + optional CLI for stuck locks                                       |
| G5  | Better API semantics                             | Active queue job → 202; stale lock → 409 with hint                           |
| G6  | Accurate docs                                    | §5.2 in doc 16 matches implementation                                        |

---

## Phase 0 — Decisions (lock before coding)

- [ ] **Single helper module** path: `ingestion/db/advisory_lock.py` (preferred)
      vs methods only on `Repository`.
- [ ] **Metric names** under `ingestion/common/metrics.py` (avoid
      high-cardinality `event_id` labels per H3 in bug review).
- [ ] **Optional CLI** `release-event-lock` in v1 or Phase 4 only.
- [ ] **UI**: Event analysis refresh shows distinct copy for
      `stale_lock_suspected` vs active job (Phase 4).

---

## Phase 1 — Advisory lock helper (Fix #1 core: verify unlock + invalidate)

**Maps to recommended fix:** _Treat unlock as mandatory and verified._

### 1.1 New module `ingestion/db/advisory_lock.py`

```python
@dataclass(frozen=True)
class AdvisoryLockHandle:
    lock_id: int
    backend_pid: int
    key: str  # e.g. "event:uuid" for logs

def compute_lock_id(key: str) -> int: ...  # move from Repository

def try_acquire(session: Session, key: str) -> AdvisoryLockHandle | None:
    """pg_try_advisory_lock; return None if not acquired."""

def release(session: Session, handle: AdvisoryLockHandle) -> bool:
    """
    rollback if needed; pg_advisory_unlock; return True if released.
    If False: log critical, session.invalidate(), return False.
    """
```

**Requirements:**

- Log `advisory_lock_acquired` with `key`, `lock_id`, `backend_pid`.
- Log `advisory_lock_released` or `advisory_lock_release_failed` with both PIDs.
- **Never** ignore `pg_advisory_unlock` scalar result.

### 1.2 Refactor `Repository`

- `acquire_event_lock` / `release_event_lock` delegate to helper (thin wrappers
  for call sites).
- Same for `acquire_source_event_lock` / `release_source_event_lock`.
- Deprecate direct `release_*` without handle in pipeline (pipeline uses
  handle).

### 1.3 Unit tests `ingestion/tests/unit/test_advisory_lock.py`

| Case                                                 | Method                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `compute_lock_id` stable                             | snapshot known uuid                             |
| `release` calls invalidate when unlock returns false | mock `session.execute` → false                  |
| rollback invoked when session in error state         | mock `session.in_transaction` / exception state |

```bash
docker exec mre-liverc-ingestion-service python -m pytest ingestion/tests/unit/test_advisory_lock.py -q
```

**Acceptance:** Unit tests green; no change to pipeline behaviour yet (wiring in
Phase 2).

---

## Phase 2 — Pipeline wiring (Fix #2: pin connection; Fix #3: rollback-then-unlock)

**Maps to:** _Hold one connection for lock acquire → persist → unlock_ and _On
any persist failure, rollback then unlock._

### 2.1 `_persist_with_lock` (`ingestion/ingestion/pipeline.py`)

Replace ad-hoc acquire/release with:

```python
with db_session() as session:
    repo = Repository(session)
    handle = advisory_lock.try_acquire(session, f"event:{event_context.event_id}")
    if handle is None:
        raise IngestionInProgressError(...)
    lock_held = True
    try:
        return await self._run_with_inactivity_timeout(...)
    finally:
        if lock_held:
            advisory_lock.release(session, handle)
            lock_held = False
```

Remove duplicate logic from `_release_event_lock_safely` **or** make it a thin
wrapper around `advisory_lock.release` for backward compatibility.

### 2.2 `_ensure_event_record`

- Use `try_acquire` / `release` with `source_event:{source_event_id}` in
  `finally`.
- Keep section **short** (no race fetches inside).

### 2.3 Constraint-violation retry block

- On retry: only set `lock_held = False` after `release()` returns True or
  invalidates.
- Do not call bare `repo.release_event_lock` without verification.

### 2.4 Delete or narrow `_release_event_lock_safely`

- If kept: delegate to `advisory_lock.release`; do not duplicate
  rollback/invalidate logic.

### 2.5 Integration tests (Postgres required)

File: `ingestion/tests/integration/test_advisory_lock_lifecycle.py`

| Test                                          | Steps                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `test_lock_released_after_successful_persist` | Minimal ingest fixture event; assert no advisory lock in `pg_locks` after |
| `test_lock_released_after_simulated_failure`  | Force validation/DB error mid-persist; assert second acquire succeeds     |
| `test_sequential_ingests_same_pool`           | Two full ingests (or acquire/release cycles) via pool; 0 stale locks      |

Use same Docker Postgres as other integration tests.

```bash
docker exec mre-liverc-ingestion-service python -m pytest ingestion/tests/integration/test_advisory_lock_lifecycle.py -q
```

**Acceptance:** Integration tests green; manual check:

```bash
docker exec mre-postgres psql -U pacetracer -d pacetracer -c \
  "SELECT * FROM pg_locks WHERE locktype='advisory';"
```

after ingesting an event → **0 rows**.

---

## Phase 3 — Observability

### 3.1 Metrics (`ingestion/common/metrics.py`)

Add counters **without** per-event labels:

- `ingestion_advisory_lock_acquire_conflicts_total` — `pg_try` returned false
- `ingestion_advisory_lock_release_failures_total`
- `ingestion_advisory_lock_leaked_suspected_total` — false acquire + no active
  job

### 3.2 Pipeline stage

Keep `await_event_lock` stage; add log when conflict includes `active_job_id` if
any.

---

## Phase 4 — API and UX (Fix #4: active job vs stale lock)

**Maps to:** _Surface queue state when lock is held by an active worker._

### 4.1 `ingestion/api/job_queue.py`

```python
def get_active_job_for_event_id(event_id: str) -> Job | None:  # already exists — export for routes
```

### 4.2 `ingestion/api/routes.py`

Before `enqueue_by_event_id` / sync `ingest_event`:

- If client needs idempotency: already deduped on enqueue.

Inside pipeline or route when translating `IngestionInProgressError`:

- Optional helper
  `classify_lock_conflict(event_id) -> active_job | leaked_suspected`.

For **sync** ingest path only (queue disabled):

- If active job → return 202-style body with `job_id`.

When raising `IngestionInProgressError`, attach `details`:

```python
{"hint": "stale_lock_suspected", "active_job_id": null}
# or
{"hint": "ingestion_running", "active_job_id": "..."}
```

### 4.3 Next.js (optional in this phase)

- `src/lib/ingestion-error-map.ts` — map `stale_lock_suspected` to user message
  pointing at support/runbook.
- `EventAnalysisSidebar.tsx` — on 409 with hint, show “Import lock stuck — try
  again after a minute or contact admin” vs “Import already running”.

### 4.4 Optional CLI (ops)

```bash
docker exec mre-liverc-ingestion-service python -m ingestion.cli ingest liverc diagnose-event-lock --event-id <uuid>
```

Prints: computed `lock_id`, whether `pg_try` would succeed, active job, advisory
rows in `pg_locks`.

Optional:

```bash
... release-event-lock --event-id <uuid> --confirm
```

**Only** runs `pg_advisory_unlock` on a fresh dedicated connection — cannot
unlock another PID’s lock; document that **terminate backend** or **restart
service** is the real fix for leaks. CLI is diagnostic + documents recovery.

**Acceptance:** Manual test: start ingest, second POST returns same `job_id`
(202); simulated leak returns 409 with `stale_lock_suspected`.

---

## Phase 5 — Documentation and runbook (Fix #5)

### 5.1 Update architecture

- [16-ingestion-concurrency-and-locking.md](../architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md)
  §5.2 — replace `asyncio.wait_for` lock timeout text with inactivity + §4.3
  unlock in `finally`; link to doc 32.
- [21-ingestion-recovery-procedures.md](../architecture/liverc-ingestion/21-ingestion-recovery-procedures.md)
  — § stuck advisory locks → link runbook.
- [11-ingestion-error-handling.md](../architecture/liverc-ingestion/11-ingestion-error-handling.md)
  — `INGESTION_IN_PROGRESS` details hints.

### 5.2 Runbook

Publish
[ingestion-lock-recovery-runbook.md](../operations/ingestion-lock-recovery-runbook.md)
(created with this package).

### 5.3 Mark plan status

Update this file `status:` to **Implemented** with date when all phases checked.

---

## Implementation order (recommended)

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 5 (docs) → Phase 4 (API/UX)
```

Phase 2 is the critical path. Phase 4 can ship after Phase 2 if API changes need
product review.

---

## Test matrix (full regression)

| Area                | Command                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New unit tests      | `pytest ingestion/tests/unit/test_advisory_lock.py`                                                                                                                                                      |
| New integration     | `pytest ingestion/tests/integration/test_advisory_lock_lifecycle.py`                                                                                                                                     |
| Existing locks test | `pytest ingestion/tests/unit/test_concurrent_ingestion_locks.py`                                                                                                                                         |
| Job queue dedupe    | `pytest ingestion/tests/unit/test_job_queue_store.py`                                                                                                                                                    |
| Full ingestion unit | `pytest ingestion/tests/unit/ -q`                                                                                                                                                                        |
| Manual ingest       | `docker exec mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <uuid> --depth laps_full` twice sequentially — second should not false-409 after first completes |

---

## Files touched (checklist)

| File                                                          | Change                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ingestion/db/advisory_lock.py`                               | **New**                                                                           |
| `ingestion/db/repository.py`                                  | Delegate lock id / acquire / release                                              |
| `ingestion/ingestion/pipeline.py`                             | `_persist_with_lock`, `_ensure_event_record`, retry, simplify `_release_*_safely` |
| `ingestion/common/metrics.py`                                 | New counters                                                                      |
| `ingestion/api/routes.py`                                     | Conflict classification (Phase 4)                                                 |
| `ingestion/cli/commands.py`                                   | Optional diagnose/release (Phase 4)                                               |
| `ingestion/tests/unit/test_advisory_lock.py`                  | **New**                                                                           |
| `ingestion/tests/integration/test_advisory_lock_lifecycle.py` | **New**                                                                           |
| `src/lib/ingestion-error-map.ts`                              | Optional hints (Phase 4)                                                          |
| `docs/...`                                                    | This plan + architecture + runbook                                                |

---

## Out of scope (v1)

- Redis / distributed lock layer
- Removing Next.js `ingestion-lock.ts`
- Changing `INGESTION_QUEUE_MAX_CONCURRENT` default
- Fixing high-cardinality metric labels (bug review H3) — separate PR

---

## Definition of done

- [ ] All phases 1–3 complete with tests in Docker
- [ ] No advisory locks in `pg_locks` after ingest integration test
- [ ] ADR status → Accepted
- [ ] Doc 32 `status` → implemented (remove “target” wording)
- [ ] Runbook reviewed by operator
- [ ] Investigation review linked from
      [liverc-ingestion README](../architecture/liverc-ingestion/01-overview.md)
      or doc 16
