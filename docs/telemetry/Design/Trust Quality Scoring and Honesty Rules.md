# Trust, Quality Scoring, and Honesty Rules

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define how MRE establishes trust in telemetry outputs, quantifies data
quality, communicates uncertainty, and enforces honesty and non-deceptive
behaviour across the product.  
License: Proprietary, internal to MRE

## 1. Scope

This document defines:

- A trust model for telemetry ingestion, processing, and derived insights
- A quality scoring framework (signals, scoring, thresholds, and feature gating)
- Honesty and disclosure rules for UI, API, exports, and automation
- Auditability, provenance, and reproducibility requirements
- Operator and user workflows for reprocessing, overrides, and disputes

Out of scope:

- Full algorithms for lap detection, fusion, and segment inference
- Device-specific parser compatibility details
- UI design details and exact copy, beyond required disclosure semantics
- Legal policy and terms, except where honesty disclosure impacts product
  behaviour

## 2. Design goals

- Provide users with reliable telemetry insights without over-claiming precision
- Make uncertainty visible, actionable, and consistent across the product
- Ensure quality scoring is explainable and debuggable by operators
- Protect user trust by preventing hallucinated or fabricated values
- Support incremental improvement as new devices, formats, and models are added

## 3. Definitions and taxonomy

### 3.1 Core concepts

- **Truthfulness**: Do not present information as known if it is not known.
- **Confidence**: A measure of how likely an output is correct, given observed
  signals.
- **Quality**: A measure of data usefulness for a specific purpose (laps, racing
  line, comparison).
- **Provenance**: Traceable lineage from raw artifact to derived output, with
  versions.
- **Honesty Rule**: A product-wide constraint on how MRE speaks and displays
  results.

### 3.2 Output types

MRE outputs fall into categories, each with different risk and disclosure needs:

- **Direct observations**: values directly measured, for example GNSS lat, lon,
  speed, IMU accel.
- **Corrected observations**: values adjusted by deterministic rules, for
  example unit conversion, time alignment.
- **Derived metrics**: computed quantities, for example lap time, max speed,
  average throttle.
- **Inferred semantics**: higher-level inferences, for example "Turn 3 apex",
  "jump", "off-track moment".
- **Predictions or recommendations**: suggestions, for example setup tips,
  driving advice.

The higher the level, the stronger the disclosure requirement.

## 4. Trust model

### 4.1 Trust dimensions

MRE assigns trust across these dimensions:

1. **Integrity**: Is the input authentic and uncorrupted?
2. **Completeness**: Is required data present, continuous, and aligned?
3. **Accuracy**: Are signals plausible and consistent with physics and device
   specs?
4. **Stability**: Are outputs consistent across runs, versions, and
   reprocessing?
5. **Explainability**: Can we explain why the system produced a result?

Trust is not a single number, it is a set of signals summarised for the user.

### 4.2 Provenance requirements

Every user-visible metric must be traceable to:

- Artifact ids and hashes
- Processing run id
- Parser version and pipeline version
- Fusion version (if used)
- Algorithm configuration snapshot
- Derived dataset ids and hashes

Exported reports must embed or link to this provenance.

### 4.3 Reproducibility rule

Given identical artifacts, identical versions, and identical configuration:

- The pipeline must be deterministic.
- If a stage is non-deterministic due to numerical methods, record seed and
  tolerances.

If deterministic replay is not possible for a component, MRE must disclose this
and label results appropriately.

## 5. Quality scoring framework

### 5.1 Overview

MRE computes:

- **Signal scores** per stream, for example GNSS, IMU, throttle
- **Stage scores** per pipeline stage, for example parsing, time alignment,
  fusion health
- **Task suitability scores** for user tasks, for example lap timing, line
  comparison, segment analysis
- **Overall session score** as a summary, not a replacement for detail

Quality is purpose-dependent. A session can be high quality for lap timing but
low quality for racing line.

### 5.2 Score scale and representation

Use a 0 to 100 integer score with a categorical label:

- 90 to 100: Excellent
- 75 to 89: Good
- 55 to 74: Fair
- 35 to 54: Poor
- 0 to 34: Unusable

Also store raw sub-scores and flags for debugging.

### 5.3 Quality signals

Signals are grouped and weighted differently per task.

#### 5.3.1 Integrity signals

- Artifact hash matches recorded sha256
- Parser succeeded without recovery mode
- No schema mismatches or truncated reads
- Time range is plausible, for example not negative durations

#### 5.3.2 GNSS signals

- Fix type, satellites used, HDOP or equivalent if available
- Position jitter, speed jitter
- Dropout rate, gap lengths
- Teleport events, impossible jumps in position
- Average sampling rate vs expected
- Course over ground consistency with velocity vector
- Track boundary plausibility (within a plausible region)

#### 5.3.3 IMU signals

- Sampling rate stability
- Saturation clipping events
- Bias drift indicators
- Axis plausibility, gravity magnitude consistency
- Synchronisation health with GNSS timestamps

#### 5.3.4 Time alignment signals

- Monotonicity violations corrected
- Stream offset and drift estimates
- Interpolation fraction and maximum gap bridged
- Number of resynchronisation events

#### 5.3.5 Fusion health signals

- Innovation residual magnitudes
- Filter divergence detection
- Fraction of time in degraded mode
- Map matching usage, if any
- Confidence intervals width

#### 5.3.6 Racing semantics signals

- Lap detection stability, for example consistent lap lengths
- Start-finish confidence and re-detection events
- Segment inference stability across laps
- Off-track detection rates and clustering

### 5.4 Derived score computation

#### 5.4.1 Signal score calculation

Each stream has a base score, penalised by issues:

Example penalties (illustrative, tune over time):

- Dropout rate > 5%: minus 10
- Largest gap > 2 seconds: minus 10
- Teleport events: minus 15 per event, capped at minus 40
- Sampling rate variance > threshold: minus 10
- HDOP missing: minus 5, if required for the device family

Each penalty must map to a structured reason code.

#### 5.4.2 Task suitability scoring

Task score is a weighted sum of signal scores plus task-specific checks:

- Lap timing relies heavily on stable timestamps and start-finish confidence
- Racing line relies heavily on position jitter and fusion health
- Segment and corner analysis relies on consistent path shape and multi-lap
  repeatability

Store these as:

- `task_score.lap_timing`
- `task_score.racing_line`
- `task_score.segments`
- `task_score.comparison`

#### 5.4.3 Overall session score

Overall score is a conservative summary:

- Use the minimum of key task scores, or a weighted sum biased toward the
  lowest.
- Never allow overall score to exceed the lowest critical task score by more
  than 10.

This prevents a high score masking a critical weakness.

### 5.5 Feature gating thresholds

Features must be gated by task suitability scores and flags, not only overall
score.

Example default thresholds:

- Lap table and lap times: `lap_timing >= 55` and no critical flags
- Lap to lap comparison: `comparison >= 75` and fusion stable if used
- Racing line heatmaps: `racing_line >= 75`
- Segment analysis: `segments >= 75`
- Recommendations and coaching: only when `comparison >= 75` and
  `racing_line >= 75`, otherwise show "insufficient quality" disclaimer

Critical flags override numeric thresholds, for example:

- Integrity failure, checksum mismatch
- Time base corruption beyond recovery
- Non-retriable parser errors

### 5.6 Quality degradation and partial outputs

If a stage fails or is skipped:

- Downstream tasks dependent on that stage must be flagged as unavailable.
- MRE may still show partial outputs if they are truthful, for example raw GNSS
  track even if lap detection failed.
- MRE must clearly label the output as partial and explain why.

## 6. Honesty rules

### 6.1 Non-deception principles

MRE must never:

- Fabricate metrics, laps, segments, or values not computed from real data
- Present an inferred value as measured
- Hide known limitations, failures, or missing data
- Use UI language that implies certainty when uncertainty is high

When uncertain, MRE should:

- Say what is known
- Say what is unknown
- Say why it is unknown
- Say what could improve it, for example better device settings, more samples,
  reprocess

### 6.2 Required disclosure labels

Every user-facing output must include one of these labels:

- **Measured**: direct from sensor stream, with known unit and sampling
- **Corrected**: deterministic transformation, for example unit conversion,
  smoothing, time alignment
- **Derived**: computed metric, for example lap time, speed delta, based on
  defined algorithms
- **Inferred**: semantic inference, for example corner classification, with
  confidence and criteria
- **Estimated**: when approximate due to missing data, must include error bounds
  or confidence

Labels must be consistent across UI, API, and exports.

### 6.3 Confidence and uncertainty display

For outputs above "Corrected", MRE must attach:

- A confidence rating: High, Medium, Low
- The numeric task score relevant to that output
- At least one reason code if confidence is not High

For example:

- Lap time displayed with confidence and a tooltip listing: "GNSS gaps",
  "Timestamp jitter corrected".

### 6.4 No silent smoothing rule

Any smoothing, filtering, or gap-filling beyond trivial interpolation must be
disclosed:

- The technique used, for example "moving average 0.5s", "Kalman fusion"
- The degree, for example how much of the data is interpolated
- Whether results are still suitable for precise comparisons

### 6.5 Version disclosure rule

If results depend on algorithm versions:

- UI must show the pipeline version in the run details
- When results change after reprocess, UI must provide a diff summary:
  - "Lap detection improved", "Fusion now enabled", or "Downsample changed"
- Exports must embed version metadata

### 6.6 Claim boundaries and phrasing rules

MRE must not use phrases implying certainty unless conditions are met:

Not allowed unless confidence is High:

- "This is your fastest corner because..."
- "You definitely braked later..."
- "Your car understeered at Turn 2..."

Allowed with Medium or Low confidence:

- "It looks like you may have braked later, but GNSS jitter is high."
- "There is a possible understeer pattern, confidence is Low due to dropout."

### 6.7 External data honesty

If MRE uses external data, for example weather or track location:

- Distinguish sourced data from computed telemetry
- Cite provenance: provider, timestamp, and resolution
- If data is missing, do not guess, show "Unknown" and suggest how to supply it

### 6.8 User override transparency

If the user manually edits:

- Start-finish line
- Track map alignment
- Segment boundaries

MRE must:

- Label any downstream metrics as "user-adjusted"
- Store the user change as a versioned overlay
- Preserve the original auto-detected result for audit and reversion

## 7. Reason codes and explainability

### 7.1 Reason code design

Use stable reason codes for penalties and gates:

- `GNSS_GAPS_HIGH`
- `GNSS_JITTER_HIGH`
- `TIME_ALIGNMENT_DRIFT`
- `IMU_SATURATION`
- `FUSION_DIVERGED`
- `LAP_DETECTION_UNSTABLE`
- `INTEGRITY_HASH_MISMATCH`

Each reason code includes:

- Short description for UI
- Operator detail with thresholds and observed values
- Suggested remediation steps if user-actionable

### 7.2 Minimum explainability payload

Every session must have an "Explain" panel that includes:

- Overall score and task scores
- Top 3 reason codes impacting each task
- A link to run details and provenance

## 8. API contract requirements

### 8.1 Quality in API responses

Any API that returns derived metrics must include:

- `quality`: task score and label
- `confidence`: High, Medium, Low
- `provenance`: run id, versions, dataset ids
- `reasons`: list of reason codes

If a value is not available, return explicit nulls and a reason, not
placeholders.

### 8.2 Error handling honesty

APIs must avoid ambiguous success responses:

- If a pipeline is still running, return a clear `processing` status
- If partial, return `partial` and specify missing features
- If failed, return `failed` with error codes and remediation hints

## 9. Data quality governance

### 9.1 Calibration and tuning

Quality scoring thresholds must be treated as product configuration:

- Stored as versioned config
- Changes recorded in an ADR
- Evaluated against sample datasets before rollout

### 9.2 Regression protection

Introduce tests:

- Golden sample sessions with expected quality scores in ranges
- Detection that score distributions do not shift drastically without intent
- Alerts when a new parser version causes a spike in failures or downgrades

## 10. Security and privacy implications

- Quality reasons must not leak sensitive info in logs, for example exact
  coordinates
- Summaries should avoid exposing precise location unless user explicitly opts
  in
- Store minimal necessary details for debugging, with access controls for
  operators

## 11. UI copy rules

### 11.1 Required UI elements

- A visible score badge and label
- A one-click explanation of why the score is what it is
- A clear indicator when features are disabled, with reasons and next steps

### 11.2 Default copy patterns

- If High confidence: "Reliable"
- If Medium: "Usable, some uncertainty"
- If Low: "Approximate, treat with caution"
- If Unusable: "Not enough data to compute this"

Avoid blaming language. Focus on data conditions and suggestions.

## 12. Examples

### 12.1 Example: Lap times with medium confidence

- `lap_timing = 68 (Fair)`
- Reasons: `GNSS_GAPS_HIGH`, `TIME_ALIGNMENT_DRIFT`
- UI: Show lap times with warning, disable lap-to-lap deltas

### 12.2 Example: Racing line disabled

- `racing_line = 48 (Poor)`
- Reasons: `GNSS_JITTER_HIGH`, `GNSS_TELEPORT_EVENTS`
- UI: Hide heatmap, show raw breadcrumb path with caution

### 12.3 Example: User override

- User adjusts start-finish line
- Lap detection now stable, lap scores improve
- UI: "Laps are based on your start-finish line adjustment", with revert option

## 13. Implementation checklist

- [ ] Define reason code enum and mapping to descriptions and thresholds
- [ ] Compute and persist signal scores and task scores per run
- [ ] Persist feature availability flags and reasons for UI
- [ ] Ensure APIs include quality, confidence, reasons, and provenance
- [ ] Add UI explanation panel
- [ ] Add golden dataset regression tests for score stability
- [ ] Document score threshold changes via ADR

## 14. Future evolutions

- Adaptive weighting by device family, environment, and track type
- User-specific calibration, for example known start-finish location
- Automated feedback loops from user overrides to improve default heuristics
- Confidence intervals for key metrics, not only categorical confidence
