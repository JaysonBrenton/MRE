---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Validation rules for LiveRC ingestion data quality and consistency
purpose:
  Defines strict validation rules applied to all data received from the LiveRC
  connector before database insertion. Ensures data quality, consistency, and
  prevents partial or corrupted data from entering the system.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 12. Ingestion Validation Rules (LiveRC Ingestion Subsystem)

This document defines the strict validation rules applied to all data received
from the LiveRC connector before insertion into the database. The goals of
validation are to guarantee data quality, enforce consistency, prevent partial
or corrupt ingestion, and ensure deterministic behaviour across re-ingestions.

These rules apply to all ingestion depths (currently only `laps_full` in V1).

Validation MUST occur **after connector parsing** but **before DB persistence**.

---

## 1. Validation Philosophy

Validation MUST ensure:

1. No malformed or inconsistent data enters the database.
2. Every field ingested from LiveRC is correct, complete, and typed properly.
3. Race, result, and lap structures are internally coherent.
4. Re-ingestion produces identical results when source data is unchanged.
5. Failures are detected early, before writing anything.

Validation MUST be:

- deterministic
- strict (fail fast)
- non-silent (no auto-fixing)
- transparent in errors

The ingestion pipeline MUST NOT “guess”, “correct”, or “infer” missing values.

---

## 2. Event-Level Validation

The following fields MUST be validated for every event:

- `source_event_id`  
  MUST be a non-empty string; MUST match the ID derived from the URL.

- `event_name`  
  MUST be non-empty.

- `event_date`  
  MUST parse into a valid ISO timestamp.  
  MUST NOT be null.

- `event_entries`  
  MUST be an integer >= 0.

- `event_drivers`  
  MUST be an integer >= 0.

Additional structural rules:

1. Race list MUST NOT be empty.
2. Race ordering MUST be strictly increasing by `race_order`.
3. No two races may share the same `source_race_id`.
4. No two races may share the same `race_order`.

Failure of any rule MUST abort ingestion.

---

## 3. Race-Level Validation

Each race MUST satisfy:

- `source_race_id`  
  MUST be a non-empty string.

- `class_name`  
  MUST be a non-empty string.

- `race_label`  
  MUST be a non-empty string (“A-Main”, “Heat 1”, etc.).

- `race_order`  
  MUST be a positive integer.

- `race_url`  
  MUST be a valid URL.

- `start_time`  
  MAY be null, but if provided MUST parse to a valid timestamp.

- `duration_seconds`  
  MAY be null, but if provided MUST be an integer >= 0.

### Race Result Consistency

For each race:

- There MUST be at least one result row.
- All results MUST contain unique `source_driver_id`.
- All results MUST contain unique `position_final` values.
- `position_final` MUST be positive integers starting at 1.

Duplicate driver IDs MUST cause ingestion to fail.

Missing or inconsistent driver rows MUST fail ingestion.

---

## 4. Driver Result Validation (within each race)

Each result row MUST satisfy:

- `source_driver_id`  
  MUST be a non-empty string.

- `display_name`  
  MUST be a non-empty string.

- `position_final`  
  MUST be a positive integer.

- `laps_completed`  
  MUST be >= 0.

- `total_time_seconds`  
  MUST be a valid float >= 0.

- `fast_lap_time`  
  MAY be null, but if present MUST be a float > 0.

- `avg_lap_time`  
  MAY be null, but if present MUST be a float > 0.

- `consistency`  
  MAY be null, but if present MUST be a float between 0 and 100 inclusive.

### 4.1 Entry List Validation (Data Integrity Rule)

**CRITICAL:** Race result drivers MUST be validated against the event entry list
for the race's class.

- Each race result driver MUST match an `EventEntry` record for the race's
  `class_name`.
- Matching is performed by:
  1. `source_driver_id` (if available in EventEntry's driver)
  2. Normalized driver name (exact match)
- If a race result driver does NOT match any `EventEntry` for the race's class:
  - The race result MUST be **skipped** (not written to database)
  - A warning log MUST be emitted with driver and class details
  - Ingestion MUST continue processing other results
  - The driver will still be processed if they appear in races for classes they
    ARE entered in

**Rationale:** This ensures data integrity by preventing drivers from appearing
in classes they're not entered in. This can occur due to:

- LiveRC incorrectly labeling races
- Race label parsing extracting wrong class names
- Mixed-class races (shouldn't happen but might)

**Multi-Class Driver Support:** Drivers who enter multiple classes will still be
processed correctly:

- When processing a race for Class A → if driver is entered in Class A →
  processed
- When processing a race for Class B → if driver is NOT entered in Class B →
  skipped (with log)
- When processing a race for Class C → if driver is entered in Class C →
  processed

This ensures drivers only appear in classes they're actually entered in, while
preserving their data in all valid classes.

Additional required relationships:

- If `laps_completed` > 0, then lap series MUST exist and MUST contain exactly
  `laps_completed` lap entries.
- If `laps_completed` == 0, lap series MAY be empty or not provided.

Contradictions MUST fail ingestion:

- `laps_completed` does not match number of laps parsed.
- `total_time_seconds` is lower than sum(lap_time_seconds) by an unreasonable
  margin (optional future rule).
- Negative or zero lap times for any lap (except lap 0 warmup entries where
  applicable).

---

## 5. Lap-Level Validation

Each lap MUST satisfy:

- `lap_number`  
  MUST be an integer >= 1 (except lap_num 0 warmup, which MUST be explicitly
  allowed only if present in source).

- `position_on_lap`  
  MUST be an integer >= 1.

- `lap_time_seconds`  
  MUST be a float > 0.

- `lap_time_raw`  
  MUST be a non-empty string representing the original value.

- `pace_string`  
  MAY be null, but if present MUST be non-empty.

- `elapsed_race_time`  
  MUST be a float >= `lap_time_seconds`.

- `segments`  
  MUST be a list (may be empty).  
  If present, each segment MUST be a non-empty string.

### Structural Lap Rules

For each race result:

- Lap numbers MUST start at 1 and increase sequentially by 1, except optional
  lap 0 warmup.
- No missing lap numbers.
- No duplicate lap numbers.
- Lap count MUST exactly match `laps_completed`.

If any violation occurs, ingestion MUST fail.

---

## 6. Cross-Race and Cross-Driver Validation

### 6.1 Event-Level

- All races within an event MUST reference the same `source_event_id`.
- All race URLs MUST contain the event’s track slug.
- All driver IDs MUST remain consistent across laps and results.

### 6.2 Race-Level

- Results MUST correspond to drivers appearing in lap data.
- Lap tables MUST NOT contain drivers missing from result rows.

### 6.3 No Orphan Data

- A lap MUST never exist without a corresponding result row.
- A result row MUST never exist without a corresponding race.
- A race MUST never exist without a corresponding event.

---

## 7. Validation Failure Behaviour

On ANY validation failure:

1. Ingestion MUST stop immediately.
2. No database writes MUST occur (full rollback).
3. A structured error MUST be returned.
4. Logs MUST include:
   - event_id
   - race_id (if applicable)
   - driver_id (if applicable)
   - field that violated rules
   - nature of failure

Validation failures MUST NOT attempt auto-correction.

---

## 8. Non-Validation Tolerances (Allowed Imperfections)

These items MUST NOT cause ingestion to fail:

- Missing pace_string values
- Missing segment data
- Missing start_time or duration_seconds
- Extra whitespace in names
- Random HTML quirks that do not affect core data structure

These are “non-critical” and ingestion MUST proceed.

---

## 9. Future-Ready Extensions

Validation logic MUST support future ingestion features:

- Segment-level time validation
- Derived metrics validation
- Cross-session driver consistency checks
- Multi-source conflict resolution
- Replay of ingestion under multiple HTML fixture versions (testing)

These MUST NOT weaken existing strictness rules.

---

End of 12-ingestion-validation-rules.md.
