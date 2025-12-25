---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Error handling rules and recovery strategies for ingestion operations
purpose: Defines error categories, propagation strategy, and recovery behaviour for all
         ingestion operations. Ensures errors are deterministic, structured, and properly
         handled to maintain data integrity and provide clear operational feedback.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/21-ingestion-recovery-procedures.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 11. Ingestion Error Handling (LiveRC Ingestion Subsystem)

This document defines the rules, error categories, propagation strategy, and
recovery behaviour for all ingestion operations within the My Race Engineer
(MRE) LiveRC subsystem. Errors MUST be deterministic, structured, and MUST NOT
expose raw HTML, connector internals, or browser/HTTP details.

Error-handling rules apply equally to:

- CLI ingestion commands
- Admin-triggered ingestion
- API-triggered ingestion (POST /events/{id}/ingest)
- Background ingestion tasks (future extension)

---

## 1. Design Goals

Error handling within ingestion MUST:

1. Maintain database integrity (no partial ingestion).
2. Provide deterministic error shapes to the caller.
3. Fail early and loudly on malformed data.
4. Clearly distinguish connector vs normalisation vs DB vs state machine errors.
5. Make ingestion idempotent even when failing.
6. Permit safe re-ingestion immediately after failure.
7. Produce actionable structured logs for diagnosis.

---

## 2. Major Error Categories

All ingestion-related errors fall into one of the following categories.

### 2.1 Connector Layer Errors

These originate from the scraping/parsing subsystem.

Examples:

- ConnectorHTTPError
- EventPageFormatError
- RacePageFormatError
- LapTableMissingError
- UnsupportedLiveRCVariantError

Connector errors MUST:

- Bubble up to ingestion unchanged in terms of high-level error code and message.
- Cause ingestion to stop immediately.
- Trigger rollback of any attempted writes.
- Be logged with connector context information (URL, page type, retry count).

### 2.2 Normalisation Errors

These occur when the connector returns structurally valid objects but certain
fields cannot be converted into canonical ingestion formats.

Examples:

- Invalid lap time string that cannot be parsed into seconds.
- Unparseable event or race timestamp.
- Missing mandatory numeric fields (laps_completed, position_final).
- Unexpected negative or zero lap durations when not allowed.

Normalisation errors MUST:

- Abort ingestion for the entire event.
- Roll back any DB state.
- Return a clear error describing the missing or malformed field.

### 2.3 Persistence (DB) Errors

These occur when performing DB operations.

Examples:

- Unique constraint violation (should not happen if idempotent logic is correct).
- Foreign key violation.
- Transaction failure or connection loss.

Persistence errors MUST:

- Abort the entire ingest run.
- Leave the database unchanged (transaction rollback).
- Return a standard ingestion error to the caller, not a raw DB or SQL message.

### 2.4 State Machine Violations

These occur when the caller requests invalid ingestion transitions.

Examples:

- Attempt to downgrade from laps_full to none.
- Attempt to ingest an event that does not exist.
- Attempt concurrent ingestion on the same event.
- Attempt to use an unknown ingest_depth.

These errors MUST:

- Return a structured ingestion error.
- Never begin connector operations or DB writes.

---

## 3. Standard Ingestion Error Shape

All ingestion errors returned to callers (CLI or API) MUST follow a standard
shape. Conceptually:

- Top-level "error" object
- Fields:
  - code: a short machine-readable string, such as INGESTION_FAILED
  - source: one of connector, normalisation, persistence, state_machine
  - message: human-readable explanation
  - details: optional structured metadata (identifiers, page type, etc.)

Rules:

- No HTML fragments.
- No raw stack traces in API responses.
- Detailed diagnostics go only into server logs, not user-facing responses.

---

## 4. Recovery Guarantees

### 4.1 No Partial Ingestion

If any stage fails:

- No races are inserted.
- No results are inserted.
- No laps are inserted.
- Event.ingest_depth MUST remain unchanged.
- The ingestion MUST be safe to retry immediately.

This is enforced via:

- Strict DB transactions.
- Event-level atomicity.
- Clear separation between read and write phases.

### 4.2 Safe Re-Ingestion

After a failure:

- The next ingestion attempt MUST be able to run without conflict.
- No previous partial data should exist; DB MUST reflect either:
  - fully ingested event, or
  - untouched event in state "none".

The ingestion pipeline MUST NOT depend on manual cleanup after failures.

---

## 5. Failure Scenarios and Required Behaviours

### 5.1 Page Fetch Failure (connector)

Scenario:

- HTTP 404 or 500 from LiveRC.
- Network timeout.
- DNS failure.
- Anti-bot block resulting in unexpected content or HTTP status.

Required behaviour:

- Connector raises ConnectorHTTPError.
- Ingestion controller logs the error with URL and retry count.
- Entire ingestion for the event aborts.
- DB state remains unchanged.
- Caller receives a structured error indicating a connector-level failure.

### 5.2 Page Structure Change

Scenario:

- LiveRC changes HTML structure so that:
  - expected result tables are missing, or
  - “View Laps” anchor no longer reveals the same DOM structure, or
  - critical classes or IDs disappear.

Required behaviour:

- Connector raises UnsupportedLiveRCVariantError (or a more specific format error).
- Ingestion aborts immediately.
- No fallback heuristics are applied in V1.
- A snapshot reference (not raw HTML) is logged so developers can investigate.
- Caller receives INGESTION_FAILED with source set to connector.

### 5.3 Unexpected Null or Missing Field (normalisation)

Scenario:

- Race record missing class name.
- Lap missing lap number.
- Pace string mandatory but not present.
- Data type mismatch during conversion.

Required behaviour:

- Normalisation layer raises a NormalisationError (or equivalent).
- Event ingestion aborts.
- All DB operations are rolled back.
- Error details include the offending field and context (e.g. race_id, event_id).

### 5.4 Incorrect Source Identifiers

Scenario:

- Duplicate driver ID returned for different drivers.
- Two races share the same source_race_id for a given event.
- Event identifier on page does not match expected source_event_id.

Required behaviour:

- Connector or normalisation layer raises a format or consistency error.
- Ingestion aborts.
- No DB changes.
- Logs clearly indicate the conflict.

### 5.5 Partial Race Extraction Failure

Scenario:

- Race metadata parsed successfully.
- Results parsed successfully.
- Lap extraction fails for one or more drivers.

Required behaviour:

- Entire event ingestion is treated as failed.
- No partial ingestion of some drivers only.
- DB remains unchanged.
- Error is logged with race and driver IDs.

### 5.6 DB Constraint Failure

Scenario:

- Foreign key constraint violation when writing laps or results.
- Unique index violation on race, result, or lap records.

Required behaviour:

- Transaction is rolled back.
- A PersistenceError (or similar) is raised.
- Error response to caller is generic but consistent; logs contain DB specifics.

### 5.7 State Machine Conflict

Scenario:

- Event currently in state laps_full, caller attempts to downgrade depth.
- Caller requests a depth that is not supported.
- Concurrency: another ingestion is running for the same event.

Required behaviour:

- Ingestion controller detects violation before calling connector.
- No scraping or DB writes occur.
- Caller receives state_machine or INGESTION_IN_PROGRESS error.
- Logs contain event_id and requested depth.

---

## 6. Logging Standards

All ingestion logs MUST be:

- Structured (for example JSON in actual implementation).
- Emitted at key lifecycle points, including:
  - ingestion_start
  - connector_fetch_start / connector_fetch_end
  - parse_start / parse_end
  - normalisation_start / normalisation_end
  - db_write_start / db_write_end
  - ingestion_error
  - ingestion_complete

Logs MUST include where applicable:

- event_id
- race_id
- driver identifiers
- timestamps and durations
- retry counts
- error codes and sources

Logs MUST NOT:

- Include raw HTML.
- Include raw DB stack traces.
- Include sensitive configuration secrets.

---

## 7. Retry Policy

### 7.1 Connector-Level Retries

Responsibilities at the connector level:

- Retry transient network failures (timeouts, connection resets) with exponential backoff.
- Do NOT retry format errors or structural HTML errors; these are deterministic failures.
- Cap retries at a small number to avoid hammering LiveRC.

### 7.2 Ingestion-Level Retries

Responsibilities at the ingestion controller level:

- MUST NOT retry individual races within a single run.
- MUST NOT attempt to “skip over” failing races.
- MUST treat ingestion of an event as all-or-nothing.
- SHOULD rely on the operator (or API client) to rerun ingestion for the event once the underlying cause is fixed.

This ensures deterministic, all-or-nothing behaviour and simplifies operational reasoning.

---

## 8. Escalation Rules

If LiveRC repeatedly returns malformed or inconsistent content leading to ingestion failures:

- Ingestion MUST fail consistently and not silently drop data.
- Monitoring SHOULD detect repeated errors for the same event or track.
- Admins SHOULD be notified via logs or monitoring alerts.
- Future tooling MAY add:
  - auto-detection of structural changes
  - test harnesses for connector parsing
  - dashboards summarising ingestion health

The ingestion system MUST prefer failing loudly over silently ingesting bad or partial data.

---

## 9. Future Extensions

Future enhancements MAY include:

- More granular error codes for analytics (e.g. CONNECTOR_TIMEOUT vs CONNECTOR_404).
- Auto-open GitHub issues or internal tickets when certain error thresholds are exceeded.
- “Dry run” ingestion mode for debugging without writing to DB.
- Self-test endpoints that run ingestion against known fixture HTML snapshots.

Any such extensions MUST preserve:

- The standard error shape for external callers.
- The all-or-nothing guarantee for event ingestion.
- Clear separation between connector, normalisation, persistence, and state machine responsibilities.

---

End of 11-ingestion-error-handling.md.
