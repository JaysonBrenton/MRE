---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Recovery procedures for LiveRC ingestion subsystem failures
purpose:
  Defines end-to-end recovery processes for the LiveRC ingestion subsystem when
  failures occur due to upstream HTML changes, network faults, database
  inconsistencies, connector errors, or internal logic breakdowns. Ensures
  ingestion stability and data integrity during recovery operations.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md
  - docs/architecture/liverc-ingestion/14-ingestion-idempotency-design.md
  - docs/architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 21. Ingestion Recovery Procedures (LiveRC Ingestion Subsystem)

This document defines the end-to-end recovery processes for the LiveRC ingestion
subsystem in My Race Engineer (MRE). Recovery procedures are critical for
maintaining ingestion stability when failures occur due to upstream HTML
changes, network faults, database inconsistencies, connector errors, or internal
logic breakdowns.

Recovery covers:

- detecting ingestion failures
- restoring consistent DB state
- retrying ingestion safely
- recovering from incomplete runs
- recovering after parser or connector updates
- recovering after fixture drift
- handling corrupted or partial event data
- emergency admin workflows

These procedures ensure ingestion is resilient, predictable, and maintainable
even under adverse conditions.

---

## 1. Principles of Recovery

1. The system must **never leave partially-ingested data in a state that appears
   complete**.
2. All ingestion operations must be **idempotent**, allowing safe retries.
3. Failures must be surfaced clearly through logs, metrics, and API state.
4. Recovery must be possible:
   - automatically (state-machine driven)
   - manually (admin or CLI)
   - in development (fixture replay)
5. Recovery must restore the DB to a known-good, internally consistent state.
6. No recovery action may silently delete user data.

---

## 2. Detecting Ingestion Failures

Failures may occur in:

- Track scraping (rare)
- Event metadata extraction
- Race page fetch
- Playwright fallback
- JS parsing (racerLaps blocks)
- Normalisation
- DB writes
- Concurrency locks
- Timeouts
- HTML drift

Detection signals include:

### 2.1 Error Envelope Returned by API

POST /events/{event_id}/ingest returns:

- code: INGESTION_FAILED
- stage: fetch | parse | normalise | db
- details: structured failure metadata

### 2.2 Observability Signals

- structured logs with severity=error
- metrics spikes:
  - connector_errors_total
  - ingestion_duration_seconds (timeouts)
- tracing spans marked failed

### 2.3 Database State

The event's ingest_depth remains unchanged.  
If ingest_depth is not “laps_full”, ingestion is incomplete.

### 2.4 CLI Exit Codes

CLI ingestion returns non-zero on failure.

---

## 3. Safe Recovery States

The ingestion state machine supports these states:

- idle
- running
- failed
- complete

Recovery must ensure the system transitions from:

failed → idle  
idle → running  
running → failed (on error)  
complete → running (safe re-ingestion)

No illegal transitions allowed.

---

## 4. Automatic Recovery Logic

When ingestion fails:

1. Lock is released
2. ingest_depth is left unchanged
3. last_ingested_at is preserved
4. error is logged
5. ingestion_status may be marked as failed (optional column)

Future ingestion attempts simply retry from the beginning.

No partial race, result, or lap data is considered authoritative until ingestion
completes.

---

## 5. Manual Recovery Procedures (Admin or CLI)

### 5.1 Step 1: Inspect Failure Logs

Admin examines:

- ingestion logs
- connector-level logs
- parser output dumps (if debug enabled)
- saved artefacts (HTML snapshots, screenshots)

### 5.2 Step 2: Validate Fixture or Live HTML

Determine if:

- upstream HTML changed
- fixtures are stale
- normaliser assumptions broke
- network was unreliable

### 5.3 Step 3: Clear Stale State (if required)

Stale state includes:

- partial race rows
- partial lap rows
- orphaned records

If needed, run:

ingestion cleanup tool:

- removes partial rows for the event
- preserves complete older ingestion runs
- does NOT delete valid data for other events

### 5.4 Step 4: Re-Run Ingestion

Re-run ingestion safely:

- CLI re-ingestion command
- admin UI’s “Retry ingestion” button
- API call POST /events/{event_id}/ingest

Due to idempotency, re-running is always safe.

---

## 6. Recovery from Partial DB Writes

In the rare case where a failure occurs after some DB writes:

### 6.1 Identify Incomplete Data

Check:

- missing races
- missing lap counts
- partial driver lists
- inconsistent ordering

### 6.2 Use Cleanup Mode

Cleanup must:

- delete all races for the event
- delete all results for the event
- delete all laps for the event
- leave the event row intact
- reset ingest_depth to "none"

### 6.3 Run Ingestion Again

After cleanup:

- ingestion runs from scratch
- results overwrite nothing
- DB state becomes consistent

---

## 7. Recovery from Upstream HTML Changes

When LiveRC changes their HTML:

### Symptoms:

- missing data fields
- parser crashes
- empty lap arrays
- broken tables
- selector failures

### Recovery Procedure:

1. capture failing HTML fixture
2. diff with previous fixture
3. repair parser selectors or JS extractors
4. update normaliser rules if required
5. regenerate fixtures (with version bump)
6. run full replay tests
7. re-run ingestion for targeted events
8. commit updated ingestion logic

No live ingestion should resume until fixtures pass.

---

## 8. Recovery from Browser Failures

Playwright may fail due to:

- timeouts
- JS execution errors
- DOM not ready
- races in rendering

### Procedure:

1. enable debug mode (shows DevTools)
2. capture screenshot + snapshot
3. adjust selectors or wait conditions
4. improve fallback logic
5. regenerate browser-generated fixture if needed
6. re-run parser and normaliser tests

If Playwright proves unstable, force httpx-only mode unless JS is mandatory.

---

## 9. Recovery from Concurrency Failures

Examples:

- stuck lock
- ingestion timeout
- long-running job blocking others

### Procedure:

1. inspect lock status
2. force-clear lock (admin-only)
3. verify ingestion is not actually running
4. retry ingestion
5. investigate timeout root cause:
   - Playwright hang
   - massive event slow parsing
   - corrupted HTML

Locks must never be cleared automatically without observability warnings.

---

## 10. Recovery from Idempotency Violations

If duplicate race or lap rows appear:

### Procedure:

1. run determinism tests
2. compare canonical expected output vs DB
3. identify offending upsert logic
4. correct idempotent constraints
5. run cleanup tool
6. re-ingest the event
7. confirm determinism across multiple replays

This ensures long-term DB consistency.

---

## 11. Recovery from Fixture Drift

If ingestion passes on live HTML but fails on fixtures, or vice versa:

### Procedure:

1. identify which fixture is stale
2. recapture HTML from LiveRC
3. compare fixture_version
4. update fixture + metadata.json
5. run regression tests
6. update snapshots
7. re-run ingestion for affected events

Fixtures are not updated unless drift is confirmed.

---

## 12. Emergency Recovery Workflows

### 12.1 Event-Level Emergency Reset

Admin may use:

reset_event_ingestion(event_id)

This performs:

- remove partial ingestion rows
- reset ingest_depth to "none"
- log event recovery
- leave event metadata intact

### 12.2 System-Level Recovery

For severe system issues:

- disable ingestion globally
- inspect resource consumption
- protect DB from further writes
- roll back ingestion-related deployments
- run ingestion test suite offline
- re-enable ingestion once stable

### 12.3 Disaster Recovery (DB Restore Not Expected)

Because ingestion is idempotent and reconstructable, full database restores
should rarely be needed.

---

## 13. Validation After Recovery

After any recovery action, the following checks must run:

- DB consistency checks
- race and lap count verification
- regression ingestion using fixtures
- ingestion duration sanity checks
- error-free logs
- stable API outputs

If any validation fails, ingestion remains disabled until corrected.

---

## 14. Long-Term Recovery Strategy

Future enhancements:

- automated ingestion retry with exponential backoff
- auto-detection of upstream HTML drift with alerting
- ingestion “health state” surfaces in admin UI
- auto-healing browser sessions
- ingestion sandbox environment for debugging
- rollbackable ingestion migrations

These measures ensure the ingestion system remains resilient for years.

---

End of 21-ingestion-recovery-procedures.md.
