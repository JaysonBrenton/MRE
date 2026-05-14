---
created: 2026-05-12
creator: Architecture & Enablement
lastModified: 2026-05-12
description:
  Testing strategy for nitro pit stop detection and strategy inference
purpose:
  Defines deterministic, fixture-first validation for pit detection quality,
  pit-time estimation, and driver strategy inference across race lengths.
relatedFiles:
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - docs/architecture/liverc-ingestion/19-ingestion-fixture-management.md
  - docs/architecture/liverc-ingestion/29-pitstop-detection-system.md
  - docs/plans/pitstop-detection-implementation-plan.md
---

# 30. Pit Stop Detection Testing Strategy

## 1. Test objectives

Validate that pit stop detection:

- runs only for nitro classes
- respects race-length priors (7m/10m/30m/60m)
- estimates pit times with consistent bounds
- infers strategy labels reliably
- avoids known false positives (outlap errors, non-pit incidents)

---

## 2. Test categories

### 2.1 Unit tests

Required units:

- nitro class gating (`is_nitro_class`)
- clean baseline construction:
  - rolling clean median
  - global clean median
  - blended baseline
- candidate generation thresholds
- refractory/min-separation checks
- pit-time estimate and uncertainty bounds
- strategy classifier from synthetic stop sequences

### 2.2 Fixture-backed integration tests

For each fixture race:

1. ingest event/race
2. run derivation
3. assert persisted outputs:
   - `lap_annotations` fuel-stop flags
   - `pit_stop_events`
   - `driver_pit_strategies`

Integration assertions must verify both count-level and sequence-level behavior.

### 2.3 Regression tests

Track quality on benchmark races:

- true positive stop detections
- false positives (especially outlap mistakes)
- strategy label agreement
- median pit-time absolute error where manual labels exist

Use stable expected snapshots for deterministic checks.

---

## 3. Mandatory scenario matrix

### 3.1 Race-length scenarios

- **7-minute nitro race:** zero-stop default; detector should be conservative.
- **10-minute nitro race:** allow 0-1 stop; first likely from ~5:00 onward.
- **30-minute nitro race:** expect common 3-stop behavior; allow variance.
- **60-minute nitro race:** model standard vs stretch cadence.

### 3.2 Behavior scenarios

- leader one-lap offset strategy (pit this lap vs next lap)
- grouped multi-driver pit windows
- outlap error right after pit (must not become second pit)
- over-stretch run-out signature (fuel-risk strategy + incident overlap)
- electric race control case (no pit detection execution)

---

## 4. Data and fixture requirements

Fixtures should include:

- at least one benchmark event for each race-length bucket
- at least one race with manual pit labels for top drivers
- at least one race with known flameout/run-out sequence

Each benchmark fixture should maintain:

- race metadata (duration, class)
- manually curated expected pit windows (if available)
- expected strategy labels for selected drivers

---

## 5. Determinism and idempotency checks

For every benchmark race:

1. Run ingestion + derivation twice.
2. Assert identical outputs in:
   - `pit_stop_events`
   - `driver_pit_strategies`
   - pit-related `lap_annotations`
3. Assert no duplicate rows after rerun.

---

## 6. Quality gates

Suggested initial CI gates for benchmark suite:

- nitro gate correctness: 100%
- deterministic rerun match: 100%
- pit false-positive cap: <= agreed threshold per race
- strategy label agreement on manually labeled drivers: >= agreed threshold

Threshold values should be recorded in the benchmark report once established.

---

## 7. Failure diagnostics

On test failure, output should include:

- driver id/name
- candidate laps vs accepted laps
- rejected-candidate reasons
- strategy scores by hypothesis
- pit-time estimate and uncertainty window

This diagnostic payload is required for fast tuning without ad hoc repro
scripts.

---

## 8. Ongoing validation cadence

- run full benchmark suite in CI on every detector change
- run scheduled replay checks on latest imported nitro events
- maintain a changelog of threshold/version updates and resulting quality deltas
