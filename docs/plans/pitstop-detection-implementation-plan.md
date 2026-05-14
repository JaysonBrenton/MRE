# Pit Stop Detection Implementation Plan

**Status:** Ready for delivery  
**Scope:** Nitro-only pit stop detection, pit time estimation, driver strategy
inference  
**Primary Design:**
`docs/architecture/liverc-ingestion/29-pitstop-detection-system.md`

---

## 1. Delivery principles

- Implement in ingestion service only; no host-local execution assumptions.
- Keep behavior deterministic and replayable from fixtures.
- Ship in phases with clear rollback points.
- Prefer additive schema changes (new tables) over risky rewrites.
- Keep current `lap_annotations` behavior intact until v2 confidence is proven.

---

## 2. Phase plan

### Phase 0 - Baseline and guardrails

#### Goals

- Define current baseline quality for `suspected_fuel_stop` on known nitro
  races.
- Lock invariants (nitro-only, idempotency, deterministic outputs).

#### Tasks

1. Add benchmark fixture list (7m, 10m, 30m, 60m races).
2. Add baseline reporting script/test for current false positives/negatives.
3. Introduce `PIT_DETECTION_VERSION` constant (`pit_v2.0` target).

#### Exit criteria

- Baseline metrics captured and documented.
- Benchmark races available for repeat regression runs.

---

### Phase 1 - Schema and repository layer

#### Goals

- Add storage for pit events and strategy outcomes.

#### Tasks

1. Prisma + SQLAlchemy model additions:
   - `pit_stop_events`
   - `driver_pit_strategies`
2. Add indexes and uniqueness:
   - `(race_result_id, lap_number)` for pit events
   - unique `race_result_id` for strategy row
3. Repository methods:
   - bulk upsert pit events
   - upsert driver strategy
   - delete/replace by race or race_result for reruns

#### Exit criteria

- Migration applies cleanly.
- Upsert and rerun behavior is idempotent.

---

### Phase 2 - Detection core (sequence model)

#### Goals

- Replace fixed-window fuel-stop logic with sequence-aware logic.

#### Tasks

1. Build baseline module:
   - rolling clean median
   - global clean median
   - blended baseline
2. Candidate generator:
   - pit-like delta band
   - candidate confidence fields
3. Sequence inference:
   - refractory separation
   - cadence scoring
   - standard vs stretch strategy hypotheses
4. Pit time estimator:
   - estimate + earliest/latest bounds

#### Exit criteria

- Deterministic outputs across repeated runs.
- Candidate and accepted events explainable in metadata.

---

### Phase 3 - Strategy inference and persistence

#### Goals

- Persist driver strategy labels and interval analytics.

#### Tasks

1. Strategy classifier:
   - `no_stop`
   - `single_stop_late`
   - `standard_cadence`
   - `stretch_cadence`
   - `disrupted_by_incident`
   - `fuel_risk_runout`
2. Compute and persist:
   - pit count
   - intervals
   - median interval
   - confidence
3. Write strategy metadata (`detection_version`, diagnostics).

#### Exit criteria

- One strategy row per race_result.
- Labels and confidence present for all nitro race results.

---

### Phase 4 - Pipeline and API integration

#### Goals

- Integrate derived pit artifacts into ingestion pipeline and read surfaces.

#### Tasks

1. Pipeline execution order:
   - existing derived laps
   - pit stop detector
2. Ensure failure isolation (per-race catch/log/continue).
3. API payload additions for event/race analysis:
   - pit stop estimates
   - strategy label/confidence

#### Exit criteria

- Existing ingestion remains stable for non-nitro races.
- API consumers can access pit and strategy outputs.

---

### Phase 5 - Observability, tuning, rollout

#### Goals

- Enable safe rollout and threshold tuning from evidence.

#### Tasks

1. Add metrics:
   - pit events per race
   - strategy distribution
   - confidence histogram
2. Add structured logs with reject reasons.
3. Shadow rollout mode:
   - compute/persist without UI exposure
4. Tune thresholds using benchmark events, then expose in UI.

#### Exit criteria

- Stable metrics for at least one full ingestion cycle.
- Documented threshold tuning notes.

---

## 3. Test plan summary

Required coverage (detailed in dedicated testing doc):

- 7-minute nitro race -> no stops expected
- 10-minute nitro race -> 0-1 stop patterns
- 30-minute nitro race -> 2-4 stop patterns
- 60-minute nitro race -> 6-7 or stretch strategy
- false-positive case: outlap error after true pit
- flameout/mechanical overlap case

---

## 4. Risk log and mitigations

### Risk: outlap error misclassified as pit

- Mitigation: cadence gating + refractory + incident overlap checks.

### Risk: strategy overfitting to elite-driver cadence

- Mitigation: class/race-length priors, not hard fixed intervals.

### Risk: schema bloat without usage

- Mitigation: ship API/UI in same milestone after shadow validation.

### Risk: regression on existing annotation logic

- Mitigation: keep old fields, additive rollout, side-by-side quality report.

---

## 5. Documentation checklist

- [x] Architecture design (`29-pitstop-detection-system.md`)
- [x] Implementation plan (this document)
- [x] Testing strategy (`30-pitstop-detection-testing-strategy.md`)
- [x] Operations runbook (`docs/operations/pitstop-detection-runbook.md`)
- [x] API reference planned placeholders added
- [ ] API reference final endpoint documentation after implementation
- [x] Schema planned placeholders added
- [ ] Schema final model documentation after migration merges
