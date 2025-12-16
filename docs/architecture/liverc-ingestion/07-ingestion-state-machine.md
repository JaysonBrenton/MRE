---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Ingestion state machine specification for LiveRC event ingestion
purpose: Defines the authoritative ingestion state machine for LiveRC events, governing
         state transitions, idempotency, and ingestion depth. Ensures consistent,
         deterministic behaviour and safe re-ingestion across all ingestion operations.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/14-ingestion-idempotency-design.md
  - docs/specs/mre-alpha-feature-scope.md
---

# 07. Ingestion State Machine (LiveRC Ingestion Subsystem)

This document defines the authoritative ingestion state machine for LiveRC
events in My Race Engineer (MRE). The ingestion subsystem MUST follow this
state model for all event-level ingestion operations to ensure consistent,
deterministic behaviour and safe re-ingestion.

The state machine governs:
- What data is allowed to exist at each stage.
- Which transitions are permitted or forbidden.
- How idempotency is maintained.
- How CLI and API ingestion commands behave.

This state machine applies only to the ingestion of a single event. It does not
cover track catalogue updates.

---

## 1. State Overview

Each event has an `ingest_depth` and `last_ingested_at` field. Only one depth
is supported in V1, but the state machine must allow future extension.

States:

1. none  
   Meaning: Event metadata exists in the Event table, but no races, results, or
   laps have been ingested.

2. laps_full  
   Meaning: Full ingestion of:
   - races
   - race results
   - race drivers
   - lap time series

No other states exist for V1.

---

## 2. Allowed Transitions

The ingestion system MUST allow the following transitions:

1. none → laps_full  
   Triggered by:
   - CLI: `mre ingest liverc ingest-event --event-id X`
   - API: POST `/events/{event_id}/ingest`

   Behaviour:
   - All race, result, driver, and lap data populated.
   - Event.ingest_depth set to `laps_full`.
   - Event.last_ingested_at set to current timestamp.

2. laps_full → laps_full  
   (Re-ingestion of the same depth)

   Behaviour:
   - MUST be fully idempotent.
   - MUST detect pre-existing data and avoid duplication.
   - MAY update timestamps.
   - Useful if LiveRC corrected data upstream or ingestion integrity checks fail.

No other transitions are permitted.

---

## 3. Forbidden Transitions

The ingestion system MUST reject the following transitions:

1. laps_full → none  
   Deleting previously ingested data is not allowed through ingestion API or CLI
   flows. Removal must be done manually by an admin or future maintenance tool.

2. laps_full → none or any other hypothetical lower-depth state  
   Downgrading ingestion depth is forbidden.

3. none → (any unknown state)  
   Only `laps_full` is valid for V1.

On violation, ingestion MUST return a validation error.

---

## 4. Entry Criteria for Each State

### 4.1 State: none  
Requirements:
- Row exists in Event table.
- Event was created by event catalogue ingestion.
- No races, results, or lap rows exist for this event.

Permitted operations:
- Searching and listing events.
- Requesting ingestion.

Forbidden operations:
- Reading race-level data or lap data (no data exists).

---

### 4.2 State: laps_full  
Requirements:
- All races for the event ingested.
- All results for all races ingested.
- All drivers for all results ingested.
- All laps for all results ingested.
- All foreign keys valid (race → event, result → race, laps → result).
- ingest_depth set to `laps_full`.

Permitted operations:
- All read APIs.
- Re-ingestion (`laps_full → laps_full`).

Forbidden operations:
- Downgrading ingestion.
- Partial overwrites via external systems.

---

## 5. Transition Rules and Validation

Before ingestion begins, the system MUST validate:

1. Event exists.  
2. Requested depth is valid (must equal `laps_full` for V1).  
3. No incompatible ingest_depth transition is attempted.  
4. No ingestion job is already running for this event (optional lock).

During ingestion, the system MUST enforce:

- Idempotent writes.
- Deterministic re-ingestion.
- Atomicity at the per-event level (errors roll back partial state where possible).

After ingestion, the system MUST:

- Update ingest_depth.
- Update last_ingested_at.
- Compute any required cached summaries (future versions).

---

## 6. Failure Modes and Recovery

Failure types:

1. Upstream fetch failure (network, parsing, HTTP error)
2. Partial data extraction failure (race missing fields)
3. Database write failure

Recovery rules:
- State MUST remain consistent.
- If ingestion fails before completing all races, the event stays in state `none`.
- If ingestion fails during a re-ingestion of `laps_full`, the existing state remains intact.

In all cases, error output MUST be:
- Deterministic
- Logged in structured format
- Returned to caller without exposing HTML

---

## 7. Determinism Requirements

The ingestion pipeline MUST:
- Produce exactly the same DB rows for the same LiveRC source pages.
- Preserve ordering for races, drivers, and laps.
- Never generate duplicate rows across re-ingestions.
- Maintain stable primary key relationships.

This ensures all analytical tools receive reliable, consistent data.

---

## 8. Future Extension Points

The state machine allows future additional depths, such as:

- laps_segmented  
- telemetry_extended  
- derived_metrics_generated

Note: `summary_only` was considered for V1 but was removed to simplify the architecture. In V1, ingestion always means full ingestion (`laps_full`).

If new depths are added:
- Transitions must be explicitly defined.
- Downgrading between depths should generally remain forbidden.
- Idempotency and determinism rules remain mandatory.

---

End of 07-ingestion-state-machine.md.
