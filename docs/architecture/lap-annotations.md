# Lap Annotations (Derived Lap Data)

**Status:** Implemented  
**Trigger:** Post-ingestion only (no on-read derivation)  
**Storage:** Same database, `lap_annotations` table

## 1. Purpose

Lap annotations are **derived** from raw lap and result data. They infer:

- **Invalid laps** – e.g. suspected track cut (lap time suspiciously fast)
- **Incidents** – crash (lap ~10–35 s over driver baseline, driver continues) or mechanical (very long lap and/or DNF)
- **Fuel stop** (nitro only) – lap in 5–15 s band over baseline and elapsed race time in 7–10 min window
- **Flame out** (nitro only) – very long lap then return to normal pace (recovered); unrecoverable flame out is treated as mechanical/DNF

Annotations are **inferred**, not ground truth. They include a confidence value and are intended for display (e.g. “Possible cut”, “Possible fuel stop”) and optional future review/override.

## 2. Data Model

### 2.1 Table: `lap_annotations`

| Column           | Type    | Description |
|------------------|---------|-------------|
| `id`             | UUID    | Primary key |
| `race_result_id` | UUID    | FK to `race_results.id` (CASCADE on delete) |
| `lap_number`     | int     | Lap number within that result |
| `invalid_reason` | string? | e.g. `suspected_cut` |
| `incident_type`  | string? | e.g. `suspected_crash`, `suspected_mechanical`, `suspected_fuel_stop`, `suspected_flame_out` |
| `confidence`     | float?  | 0.0–1.0 |
| `metadata`       | jsonb?  | Extra context (e.g. baseline, thresholds) |
| `created_at`     | timestamp | Set on insert |
| `updated_at`     | timestamp | Set on insert/update |

- **Unique:** `(race_result_id, lap_number)`  
- One row per lap that has at least one derived tag; a lap can have both `invalid_reason` and `incident_type`.

### 2.2 Relation

- `RaceResult` has one-to-many `lapAnnotations`.
- Raw lap data stays in `laps`; annotations are stored only in `lap_annotations`.

## 3. Derivation Rules

### 3.1 Invalid laps (suspected cut)

- **Class threshold:** From fast lap times of all results in the race: `threshold = max(average(fast_lap_time) * 0.2, 5)` seconds. Lap times below this are “too fast” for the class.
- **Rule:** `lap_time_seconds < class_threshold` → `invalid_reason = suspected_cut`. Optional driver-relative check: also require `lap_time_seconds < driver_median * 0.85` for higher confidence.
- **Constants:** `CLASS_THRESHOLD_FACTOR = 0.2`, `MIN_CLASS_THRESHOLD_SECONDS = 5`, `DRIVER_FAST_FACTOR = 0.85`.

### 3.2 Incidents (crash vs mechanical)

- **Driver baseline:** Median lap time for that driver in that race (excluding laps already marked invalid).
- **Crash band:** Lap time in `[baseline + 10, baseline + 35]` seconds **and** driver has later laps → `incident_type = suspected_crash`.
- **Mechanical:** Lap time > `baseline + 60` seconds **and/or** driver DNF (laps completed much lower than race leader) → `incident_type = suspected_mechanical`.
- **Constants:** `CRASH_MIN_ADDED_SECONDS = 10`, `CRASH_MAX_ADDED_SECONDS = 35`, `MECHANICAL_ADDED_SECONDS = 60`.

### 3.3 Fuel stop (nitro only)

- **Scope:** Only when class `vehicle_type` or class name indicates nitro.
- **Rule:** Lap time in `[median + 5, median + 15]` **and** `elapsed_race_time` at end of lap in `[7 * 60, 10 * 60]` seconds (7–10 min) → `incident_type = suspected_fuel_stop`.
- **Constants:** `FUEL_MIN_ADDED_SECONDS = 5`, `FUEL_MAX_ADDED_SECONDS = 15`, `PIT_WINDOW_START_SECONDS = 420`, `PIT_WINDOW_END_SECONDS = 600`.

### 3.4 Flame out (nitro only)

- **Recovered:** One (or two) very long lap(s) (`lap_time > max(median * 2.5, 60)`) **then** next lap(s) back within `median * 1.2` → `incident_type = suspected_flame_out`.
- **Unrecoverable:** Very long lap then no more laps → treated as mechanical/DNF (no separate “flame out” tag).
- **Constants:** `FLAME_OUT_LONG_FACTOR = 2.5`, `FLAME_OUT_MIN_LONG_SECONDS = 60`, `RETURN_TO_NORMAL_FACTOR = 1.2`.

## 4. Pipeline Integration

- **When:** After laps are written for a race. Derivation runs **only** as a post-ingestion step; there is no on-read derivation.
- **Where:** Ingestion service (Python). After `bulk_upsert_laps` and `session.commit()`, the pipeline calls `_run_lap_annotation_derivation(repo, race_ids_for_derivation)`.
- **Steps per race:**
  1. Load race with results and laps (and event race class for `vehicle_type`) via `repo.get_race_with_results_laps_for_derivation(race_id)`.
  2. Run `run_derivation_for_race(race_data)` to compute annotations.
  3. `repo.delete_lap_annotations_for_race(race_id)` (replace all annotations for that race).
  4. If any annotations: `repo.bulk_upsert_lap_annotations(annotations)`.
  5. Commit (after processing all races in the batch).

Failures in derivation for a single race are logged and do not fail the rest of the batch.

## 5. Code Layout (Ingestion)

- **Schema:** Prisma `LapAnnotation` model; migration `20260203120000_add_lap_annotations`.
- **Python models:** `ingestion/db/models.py` – `LapAnnotation`; `RaceResult.lap_annotations` relation. The DB column `metadata` is exposed as the Python attribute `annotation_metadata` (SQLAlchemy reserves `metadata`).
- **Repository:** `ingestion/db/repository.py`:
  - `get_race_with_results_laps_for_derivation(race_id)`
  - `bulk_upsert_lap_annotations(annotations)`
  - `delete_lap_annotations_for_race(race_id)`
- **Derivation:** `ingestion/ingestion/derived_laps/`:
  - `constants.py` – thresholds and annotation value constants
  - `class_thresholds.py` – class threshold from fast laps
  - `baselines.py` – driver median lap time
  - `invalid_laps.py` – suspected cut
  - `incidents.py` – crash / mechanical
  - `nitro.py` – fuel stop, flame out (and nitro class check)
  - `run.py` – orchestration and merge of annotations per lap
- **Pipeline:** `ingestion/ingestion/pipeline.py` – `_batch_write_races_data` returns `batch_race_ids`; after commit, `_run_lap_annotation_derivation(repo, race_ids_for_derivation)`.

## 6. App Usage

The app does **not** compute annotations. It only **reads** `lap_annotations` (e.g. via Prisma) when displaying lap data. Future work can add:

- Joining annotations to laps in event/race analysis APIs.
- UI labels (e.g. “Possible cut”, “Possible fuel stop”, “Crash”, “Mechanical”).
- Optional user override/dismissal (e.g. `overridden_at` / `overridden_by` on `lap_annotations`).

## 7. Configuration

All numeric thresholds and bands are in `ingestion/ingestion/derived_laps/constants.py`. Tuning (e.g. per class or track) can be added later without changing the pipeline flow.

## 8. Verifying after event import

To confirm ingestion and derivation for an event:

1. **Event and laps:** Query `events` (by name/date), then count `races`, `race_results`, and `laps` for that `event_id`; confirm `ingest_depth = laps_full` and `last_ingested_at` is set.
2. **Lap annotations:** Count `lap_annotations` for the event (join via `race_results` → `races` → `event_id`). Optionally group by `invalid_reason` and `incident_type` to see the mix (e.g. suspected_crash, suspected_fuel_stop).
3. **Logs:** In ingestion service logs, check for `lap_annotation_derivation_failed` for that event’s `event_id`; absence of failures indicates derivation completed. `derivation_complete` is logged at debug level.

Database cleanup (e.g. `scripts/cleanup-events.ts --force`) removes events and cascades to races, results, laps, and `lap_annotations`; no separate step is needed for annotations.
