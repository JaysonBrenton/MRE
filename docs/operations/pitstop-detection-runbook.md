# Pit Stop Detection Runbook

**Purpose:** Operational guide for validating, troubleshooting, and tuning the
nitro pit stop detection pipeline in MRE.

**Status:** Future operational runbook. Applies after pit stop detection v2
schema, pipeline, and APIs are merged.

**Design Reference:**
`docs/architecture/liverc-ingestion/29-pitstop-detection-system.md`

---

## 1. Preconditions

- Ingestion services running in Docker (`mre-liverc-ingestion-service`).
- Event ingested with laps (`ingest_depth = laps_full`).
- Race class is nitro for pit detection applicability.
- If `vehicle_type` indicates `ep`/`electric`, pit stop detection does not apply
  even when class labels contain `gp`.

---

## 2. Standard verification workflow

1. Ingest or refresh target event.
2. Confirm laps exist for target race results.
3. Verify pit outputs:
   - pit-labeled `lap_annotations`
   - `pit_stop_events` rows
   - `driver_pit_strategies` rows
4. Spot-check top drivers:
   - stop count
   - stop intervals
   - strategy label
   - confidence
5. Review logs/metrics for reject reasons and anomaly spikes.

---

## 3. What to verify per race length

- **7 minutes:** normally no pit events.
- **10 minutes:** expect sparse events (0-1 typical).
- **30 minutes:** usually ~3-stop behavior.
- **60 minutes:** recurring stop cadence with possible stretch strategy.

If observed output strongly conflicts with these priors, open a tuning ticket.

---

## 4. Common issues and actions

### 4.1 Too many pit stops detected

Likely causes:

- outlap errors misread as pit events
- threshold too wide
- insufficient refractory window

Actions:

- inspect rejected/accepted candidate metadata
- tighten pit delta band
- increase min stop separation

### 4.2 Too few pit stops detected

Likely causes:

- thresholds too strict
- cadence penalties overweighted
- baseline drift not adapting

Actions:

- inspect driver baseline windows
- relax candidate delta range
- increase rolling baseline weight

### 4.3 Wrong strategy label

Likely causes:

- sequence inference overfitted to standard cadence
- stretch hypothesis underweighted

Actions:

- review per-hypothesis score traces
- rebalance standard/stretch priors
- verify incident overlap handling

---

## 5. Tuning protocol

When changing thresholds:

1. Increment detection version (e.g. `pit_v2.1`).
2. Re-run benchmark fixture suite.
3. Compare:
   - true/false positives
   - strategy agreement
   - confidence shifts
4. Record before/after in release notes or tuning log.

Never tune from a single race alone.

---

## 6. Escalation criteria

Escalate to engineering review when:

- false positives exceed acceptable benchmark thresholds
- strategy labels regress across two or more benchmark races
- deterministic reruns produce different outputs
- ingestion latency materially increases after detector changes

---

## 7. Reporting template

For pit-detection incidents, report:

- event id / race id / class name
- detector version
- expected vs actual stop sequence (driver-level)
- suspect laps and elapsed times
- strategy label mismatch details
- logs/metrics snippets and proposed threshold actions
