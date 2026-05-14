---
created: 2026-05-12
creator: Architecture & Enablement
lastModified: 2026-05-12
description: Nitro-only pit stop detection architecture for LiveRC ingestion
purpose:
  Defines the production design for race-length-aware pit stop detection,
  pit-time estimation, and per-driver strategy inference for nitro classes.
relatedFiles:
  - docs/architecture/lap-annotations.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - ingestion/ingestion/derived_laps/nitro.py
  - ingestion/ingestion/derived_laps/run.py
---

# 29. Pit Stop Detection System (Nitro-Only)

## 1. Scope and goals

This document defines the pit stop detection system for LiveRC race laps in MRE.

Goals:

- detect likely nitro fuel stops from lap series data
- estimate pit stop time (best-effort timestamp with uncertainty)
- infer each driver's fuel strategy over a race
- avoid common false positives (outlap mistakes, crashes, mechanicals)
- support multiple race lengths, not only 60-minute mains

Non-goals:

- direct stall-camera pit lane timing (not available in LiveRC data)
- electric-class pit detection (explicitly out of scope)
- replacing existing incident annotations; this system complements them

---

## 2. Domain constraints

### 2.1 Nitro-only requirement

Pit stop detection MUST execute only when race class is nitro:

- `vehicle_type` contains `nitro`.
- If `vehicle_type` is missing/unreliable, fallback text matching may be used on
  race/class labels (`nitro` or `gp`) with safeguards.

Electric classes are always excluded:

- if `vehicle_type` indicates `ep` or `electric`, pit stop detection MUST NOT
  run, even when labels contain `gp`.

### 2.2 Race-length expectations

The model MUST be race-length-aware:

- **<= 7 minutes:** default expectation is no pit stops
- **10 minutes:** 0-1 stop is possible; first likely window usually from ~5:00
  onward
- **30 minutes:** commonly ~3 stops (allow 2-4)
- **60 minutes:** commonly 6-7 stops among front runners (allow strategic
  spread)

Expected stop count is a prior, not a hard constraint.

---

## 3. Detection architecture

Pit detection is sequence-based, not a fixed elapsed-time rule.

### 3.1 Inputs

Per driver:

- ordered lap list with `lap_number`, `lap_time_seconds`, `elapsed_race_time`
- race duration (`race.duration_seconds`) when present
- existing annotations (`suspected_crash`, `suspected_mechanical`, etc.)

### 3.2 Baselines

Maintain two pace baselines:

1. **Rolling clean baseline** (recent valid laps; adaptive)
2. **Global clean baseline** (all clean laps so far; stable)

`recent valid laps` means the most recent N laps that are not:

- already tagged pit/incidents
- invalid laps
- startup artifacts (lap 1/lap 0 edge)

Recommended initial values:

- rolling window: last 6-12 clean laps
- blended baseline: `0.65 * rolling + 0.35 * global`

### 3.3 Candidate generation

Create pit candidates when lap-time delta above baseline is in a pit-like band
(class-tunable, start with ~+4s to +10s in elite nitro contexts).

For each candidate lap, compute:

- `delta_seconds`
- `elapsed_race_time`
- local confidence (shape of inlap/outlap behavior)
- proximity to neighboring drivers' candidate windows

### 3.4 Sequence inference

Select pit events using sequence scoring over full race:

- enforce minimum separation between stops (lap/time refractory guard)
- prefer cadence-consistent sequences over isolated spikes
- allow one-lap offset between rivals as valid strategy, not noise

Evaluate at least two strategy hypotheses:

- **standard cadence** (e.g. 60m: typical 7-stop profile)
- **stretch cadence** (e.g. 60m: 6-stop attempt)

Pick the path with highest cumulative likelihood.

### 3.5 False-positive controls

Classify as non-pit when evidence is stronger for incident/outlap error:

- one-off slow lap immediately after known pit with no cadence fit
- large delta outside pit-like band with recovery pattern -> flameout candidate
- very long lap and DNF pattern -> mechanical candidate

---

## 4. Pit stop time estimation

LiveRC exposes lap completion time, not direct pit-entry timestamps.

For a confirmed pit event on lap `L`:

- `elapsed_lap_end` = cumulative elapsed at lap end
- `lap_time` = duration of lap `L`
- `elapsed_lap_start` = `max(0, elapsed_lap_end - lap_time)`
- `expected_clean_lap` = baseline lap estimate
- `pit_time_loss` = `lap_time - expected_clean_lap` (lower-bounded at 0)

Primary inference (defensible from LiveRC lap timing alone):

- the pit happened somewhere during lap `L`
- `pit_time_earliest = elapsed_lap_start`
- `pit_time_latest = elapsed_lap_end`
- `pit_time_estimate = (pit_time_earliest + pit_time_latest) / 2`

Important interpretation:

- `pit_time_loss` is an estimate of lost time, not a direct timestamp locator
- do not treat `pit_time_loss` as the uncertainty window for event timing

This representation MUST be persisted as estimate + uncertainty, not as exact
ground truth.

---

## 5. Strategy inference model

For each driver, infer race-level strategy from detected stops.

Derived fields:

- `pit_count_detected`
- `pit_elapsed_times[]`
- `pit_intervals_seconds[]`
- `median_interval_seconds`
- `strategy_label`
- `strategy_confidence`

Initial strategy labels:

- `no_stop`
- `single_stop_late`
- `standard_cadence`
- `stretch_cadence`
- `disrupted_by_incident`
- `fuel_risk_runout`

`fuel_risk_runout` applies when sequence suggests over-stretch followed by
flameout/mechanical signature.

---

## 6. Persistence design

### 6.1 Existing table (retain)

`lap_annotations` remains the per-lap annotation surface.

Continue writing:

- `incident_type = suspected_fuel_stop` for pit laps
- confidence and diagnostic metadata

### 6.2 New table: `pit_stop_events` (required)

Add normalized pit event storage:

- `id` (uuid, pk)
- `race_result_id` (fk)
- `lap_number` (int)
- `pit_time_estimate_seconds` (float)
- `pit_time_earliest_seconds` (float)
- `pit_time_latest_seconds` (float)
- `pit_time_loss_seconds` (float)
- `baseline_seconds` (float)
- `detection_confidence` (float)
- `detection_version` (string)
- `metadata` (jsonb)
- timestamps

Constraints:

- unique `(race_result_id, lap_number)`
- index `(race_result_id, pit_time_estimate_seconds)`

### 6.3 New table: `driver_pit_strategies` (required)

Persist race-level strategy outcome:

- `id` (uuid, pk)
- `race_result_id` (fk, unique)
- `strategy_label` (string)
- `strategy_confidence` (float)
- `pit_count_detected` (int)
- `median_interval_seconds` (float nullable)
- `intervals_json` (jsonb)
- `detection_version` (string)
- `metadata` (jsonb)
- timestamps

---

## 7. Pipeline integration

Run after lap ingestion and after base incident derivation:

1. load race + results + laps
2. run nitro gate
3. generate candidate pit laps per driver
4. infer stop sequence and strategy
5. upsert:
   - `lap_annotations` pit tags
   - `pit_stop_events`
   - `driver_pit_strategies`

Failure policy:

- per-race failures are logged and skipped
- ingestion of other races continues

Idempotency:

- delete/replace strategy rows per race result in same transaction scope as
  pit-event upsert, or use deterministic upsert keys

---

## 8. API and UI contract implications

Event/race analysis payloads SHOULD expose:

- per-driver pit stop list with estimated times
- strategy label and confidence
- optional pit interval sparkline values

UI copy MUST communicate uncertainty:

- "Estimated pit at 15:02 (+/- 2.1s)"
- avoid language implying stopwatch precision

---

## 9. Observability and tuning

Add metrics:

- pit events detected per race/class
- strategy label distribution
- pit confidence distribution
- false-positive review counters (manual feedback loop, when available)

Structured logs should include:

- race id, class, duration, driver id
- chosen strategy label
- candidate count vs accepted count
- rejection reasons (outlap error, mechanical overlap, low confidence)

---

## 10. Versioning and rollout

Use explicit model version tags (example: `pit_v2.0`):

- stored on pit events and strategy rows
- emitted in logs and metrics

Rollout:

1. shadow mode (compute + persist, no UI)
2. internal validation on known benchmark events
3. enable API fields
4. enable UI presentation

---

## 11. Acceptance criteria

The implementation is complete when:

- nitro-only gate is enforced
- race-length-aware priors influence inference
- pit time estimate + uncertainty is persisted
- driver strategy is persisted per race result
- 7/10/30/60-minute scenarios have fixture-backed tests
- docs and ops runbook are updated
