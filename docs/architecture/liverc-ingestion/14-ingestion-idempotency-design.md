---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Idempotency design for safe re-ingestion of LiveRC events
purpose:
  Defines formal idempotency guarantees and mechanisms ensuring that
  re-ingesting the same LiveRC event produces stable, deterministic, and
  duplicate-free database results. Critical for safe re-ingestion and recovery
  operations.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - docs/architecture/liverc-ingestion/07-ingestion-state-machine.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 14. Ingestion Idempotency Design (LiveRC Ingestion Subsystem)

This document defines the formal idempotency guarantees and the mechanisms the
MRE ingestion subsystem MUST implement to ensure that re-ingesting the same
LiveRC event produces a stable, deterministic, and duplicate-free database
state. Idempotency is critical because:

- ingestion may be triggered manually multiple times,
- ingestion may fail mid-run and be retried,
- LiveRC may correct or modify data upstream,
- connector or network conditions may require re-runs,
- future connectors may produce partial or incremental updates.

This is one of the most important backend documents. It directly governs
database integrity, ingestion correctness, re-ingestion behaviour, and long-term
operational predictability.

---

## 1. Definition of Idempotency

For ingestion, **idempotency** means:

**Running ingestion N times for the same event MUST produce the exact same
database state as running it once, assuming the LiveRC source pages have not
changed.**

Corollaries:

1. No duplicate races, results, drivers, or laps may ever exist.
2. No multiply-inserted rows.
3. No partial overwrites that cause data corruption.
4. Data MUST remain strictly stable across re-ingest, unless LiveRC source
   content has changed.

---

## 2. Scope of Idempotency

The following elements must be fully idempotent:

- Event metadata fields
- Race rows
- RaceResult rows
- RaceDriver rows
- Lap rows
- Foreign-key relationships
- Derived fields (if any in future versions)
- Ingest-depth state and timestamps

Idempotency applies to:

- HTTPX-based fetches
- Playwright-based fetches
- Normalisation layer
- DB persistence layer

It does **NOT** apply to logs or metrics (those may vary per run).

---

## 3. Primary Keys and Uniqueness Principles

Correct idempotency begins with **stable identifiers**:

### 3.1 Event-Level Identifiers

- `source_event_id` MUST uniquely identify an event across all ingestion runs.

### 3.2 Race-Level Identifiers

- `source_race_id` MUST uniquely identify a race.
- If LiveRC reorders races, the ingestion MUST still map to the correct DB rows
  by matching `source_race_id`, not by position.

### 3.3 Driver-Level Identifiers

- `source_driver_id` MUST uniquely identify a driver _within an event_.
- Driver display names MUST NOT be used as identifiers.

### 3.4 Lap-Level Identifiers

A lap is uniquely defined by:

- `race_result_id`
- `lap_number`

Thus, `(race_result_id, lap_number)` MUST form a composite unique index.

---

## 4. Idempotent Write Strategy

Every write MUST follow this generic pattern:

### 4.1 Races

- If a race with matching `source_race_id` exists:
  - Update rows if changed.
  - Do NOT insert duplicates.
- If not found:
  - Insert new row with correct FK to event.

### 4.2 Results (per race)

- For each driver:
  - Lookup by `(race_id, source_driver_id)`.
  - Update if exists, insert if not.
- No duplicate driver entries allowed.

### 4.3 Laps (per result)

- For each lap:
  - Lookup by `(race_result_id, lap_number)`.
  - Update if exists, insert if not.
- Remove-orphan behaviour is optional (see Section 7).

### 4.4 Timestamps

`last_ingested_at` MUST always update, even if data is unchanged.

---

## 5. Deterministic Ordering

Idempotency also requires stable ordering guarantees:

- Races MUST always be stored sorted by their `race_order`.
- Results MUST always be read and stored ordered by `position_final`.
- Laps MUST always be stored ordered by `lap_number`.

Even if LiveRC page order varies or contains extraneous whitespace, the
ingestion output MUST remain deterministic.

---

## 6. Handling Upstream Changes (LiveRC Modifies Data)

If LiveRC updates or corrects race/lap data, ingestion MUST:

1. Detect that the LiveRC source value differs from the DB value.
2. Update the DB row with the new value.
3. Leave unaffected fields untouched.
4. Record a new ingestion timestamp.

This allows ingestion to act as a **source-of-truth synchroniser**.

### Examples of allowed changes:

- Corrected lap times
- Updated total race time
- Revised race labels
- Corrected driver names

These MUST NOT produce duplicates.

---

## 7. Orphan Detection Rules (Optional V2 Feature)

Idempotency V1 DOES NOT require automatically deleting rows that no longer
appear in LiveRC. However, if LiveRC ever removes a lap or driver from the page,
MRE must decide a policy:

### V1 Policy (Default)

- DO NOT delete missing rows automatically.
- Instead, ingestion simply updates existing rows and inserts missing ones.

### V2 Optional Policy

- Delete orphans based on:
  - missing results
  - missing laps
  - mismatched identifiers

This must be explicitly configured and never automatic.

---

## 8. Transactional Boundaries

Idempotency requires strong DB guarantees:

### 8.1 Per-Event Transaction

The entire ingestion must run inside a single DB transaction:

- If any error occurs, rollback everything.
- The event is either:
  - fully ingested, or
  - unchanged.

### 8.2 Explicit Isolation

Ingestion MUST acquire:

- event-level advisory lock (prevent concurrent runs)
- serializable or repeatable-read transaction level where required (optional)

Isolation ensures idempotency under race conditions.

---

## 9. Connector-Level Determinism and Its Role

Idempotency is impossible if raw connector output varies per run.

Connector MUST guarantee:

- stable ordering of races
- stable ordering of results
- stable ordering of laps
- stable extraction of numeric fields
- stable extraction even if JS content loads slowly (Playwright waits)

Connector nondeterminism = ingestion nondeterminism  
Thus connector determinism is mandatory.

---

## 10. Idempotency Test Matrix

The ingestion system MUST pass the following tests:

### 10.1 Double Ingest

Run ingestion twice:

- DB state must match byte-for-byte (except timestamps).
- No new rows inserted on second run.

### 10.2 Randomised Order

If races or drivers are shuffled in the connector output (but IDs remain same):

- DB state must remain identical.

### 10.3 Partial Ingest Failure

Simulate failure halfway:

- No partial DB writes must persist.

### 10.4 Upstream Modification

Modify fixture HTML:

- DB rows must update accordingly on next ingest.

### 10.5 Missing Optional Fields

If pace strings or segments are blank:

- DB must remain valid.
- Idempotency unaffected.

---

## 11. Logging and Diagnostics for Idempotency

Logs MUST include:

- number of new rows inserted
- number of rows updated
- number of rows unchanged
- whether the ingestion was a re-ingest
- timestamps for detecting ingestion drift

Idempotency violations MUST be logged as errors, not warnings.

---

## 12. Future Extensions

Future idempotency enhancements may include:

- Hash-based change detection (compare race HTML hashes)
- Snapshot diffing to detect upstream corrections
- Incremental ingestion: only update races whose pages changed
- Multi-source idempotency (combining LiveRC + MyRCM + hardware telemetry)
- Conflict resolution policies for contradicting connectors

Each extension MUST preserve the core invariant:

**Ingesting an event multiple times MUST NOT corrupt or duplicate data.**

---

End of 14-ingestion-idempotency-design.md.
