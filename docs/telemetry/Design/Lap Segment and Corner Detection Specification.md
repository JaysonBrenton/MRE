# Lap, Segment, and Corner Detection Specification

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define the end to end specification for lap detection, segment
construction, and corner identification in MRE, including inputs, algorithms,
confidence scoring, failure modes, user overrides, and reproducibility
requirements.  
License: Proprietary, internal to MRE

## 1. Scope

This document defines:

- Inputs and prerequisites for lap, segment, and corner detection
- Data preparation and smoothing rules, with strict honesty and provenance
  requirements
- Start and finish detection and lap boundary creation
- Segment and corner inference strategies for off-road RC tracks
- Confidence, quality scoring integration, and feature gating
- Edge cases: jumps, shortcuts, marshalled repositioning, pits, partial sessions
- Manual overrides and how they affect downstream metrics and UI
- Determinism, versioning, and test strategy

Out of scope:

- Driver coaching and recommendation rules (covered elsewhere)
- Full track builder and user track authoring spec (covered elsewhere)
- Per-lap metric formula catalogue (covered elsewhere)

## 2. Design goals

- Produce stable lap timing and consistent lap boundaries for typical 1/8
  off-road sessions
- Handle messy real world telemetry without fabricating certainty
- Support multiple input sources, GNSS-only, on-board fused pose, and
  server-fused pose
- Provide deterministic results given fixed inputs, versions, and configuration
- Offer explainable confidence and reason codes when detection is uncertain or
  unavailable
- Make manual corrections easy, versioned, and transparent

## 3. Terminology

- **Track coordinate system**: A local ENU coordinate frame, origin set per
  session and stable within a processing run.
- **Trajectory**: Time-ordered series of positions in the track coordinate
  system, plus optional velocity and orientation.
- **Start/finish line (SFL)**: A directed line segment in track coordinates that
  defines lap boundaries by crossings.
- **Crossing event**: A detected intersection between trajectory segment and
  SFL.
- **Lap**: A time interval between valid SFL crossings, subject to validation
  rules.
- **Segment**: A named interval within a lap, often between key features, for
  example straight, sweeper, jump section.
- **Corner**: A localised turning region, either a segment subtype or a detected
  geometric feature.
- **Jump**: A region where vertical motion or kinematic signature indicates a
  jump or airborne phase.
- **Pit region**: An optional region with different speed distribution and path,
  often adjacent to main line.
- **Confidence**: Categorical, High, Medium, Low for each output, derived from
  task suitability and detection stability.

## 4. Inputs and prerequisites

Lap, segment, and corner detection operate on the canonical streams produced by
parsing and normalisation, plus optional fusion results.

### 4.1 Primary input streams

Preferred input hierarchy, highest to lowest:

1. **Pose stream, server_fused**  
   Local ENU position at high rate, plus velocity and optionally yaw.

2. **Pose stream, onboard_fused**  
   Local ENU position and optionally velocity and yaw.

3. **GNSS position stream**  
   Lat, lon converted to local ENU, velocity derived if not supplied.

### 4.2 Required fields

Minimum for lap detection:

- `t` and position `(x_e_m, y_n_m)` in local ENU

Strongly recommended:

- velocity magnitude `speed_mps`
- heading or yaw, if available

For jump support:

- vertical axis, either `z_u_m` or IMU derived vertical acceleration, optional

### 4.3 Preparation stage outputs and constraints

Detection must run after:

- time alignment, monotonic timestamps
- unit and coordinate normalisation
- outlier tagging, not removal, at Level 0 canonical

Strict rule:

- Detection must never alter Level 0 canonical streams in place.
- Any smoothing or gap filling used by detection must be recorded as a derived
  dataset with technique metadata and interpolation ratios.

### 4.4 Sampling rate expectations

- 5 Hz minimum for acceptable lap detection on short RC tracks, better at 10 Hz+
- 10 to 25 Hz preferred for cornering analysis and stable segment alignment
- If sampling is lower, detection may still run but confidence and feature
  availability must degrade accordingly

## 5. Data conditioning for detection

Conditioning is purpose-specific and must be disclosed.

### 5.1 Smoothing strategy

For lap and segment detection:

- Use a light smoothing on position in a derived stream, for example low-pass
  filter or Savitzky-Golay, configured by device family
- Preserve un-smoothed values for audit and raw display

For corner detection:

- Use smoothing that stabilises curvature estimates without destroying corner
  geometry

Disclosure requirements:

- Store `smoothing_type`, window length, and effective delay
- Store fraction of interpolated samples caused by gaps

### 5.2 Gap handling

- Small gaps may be interpolated for detection only, within strict thresholds
- Large gaps break continuity and must split the trajectory into “continuous
  blocks”

Recommended defaults:

- Small gap threshold: up to 0.5 seconds at 10 Hz equivalent
- Large gap: greater than 1.5 seconds
- These values should be tunable per device family

If large gaps exist:

- Lap detection can still work but crossing validation must consider block
  boundaries
- Segment and corner detection can be restricted to blocks that meet continuity
  criteria

### 5.3 Outlier handling

- Tag teleport events and impossible acceleration spikes
- Exclude tagged points from geometric computations, but do not delete them from
  the stored series

Reason codes should include:

- `TRAJ_TELEPORT_EVENTS`
- `TRAJ_GAPS_HIGH`
- `TRAJ_JITTER_HIGH`

## 6. Track model and start/finish line acquisition

Lap detection requires an SFL and a track reference. MRE supports three sources.

### 6.1 Sources of start/finish line

1. **User-defined SFL**  
   Highest authority. User draws or selects the line on the map.

2. **Known track catalogue SFL**  
   If MRE has a stored track with an SFL, it can be used as a default.

3. **Auto-detected SFL**  
   Inferred from trajectory patterns when no SFL is available.

MRE must record `sfl_source` as:

- `user_defined`
- `catalogue_default`
- `auto_detected`

### 6.2 Track coordinate origin

For each processing run:

- Choose a stable origin for local ENU, for example the first valid position or
  median of the session
- Record origin and rotation basis so results are reproducible

### 6.3 Auto-detect SFL overview

Auto-detection is an inference, not a measurement. It must be labelled
`Inferred` with confidence and reasons.

High level approach:

- Identify repeated passes through a high-density corridor, likely the main
  straight
- Locate the most consistent cross-track corridor where speed tends to be high
  and heading variance low
- Choose a perpendicular line that intersects this corridor at a stable location
- Set direction to match predominant travel direction

Auto-detected SFL must be validated by subsequent lap candidate stability. If
unstable, fall back to “no laps available” unless user provides SFL.

## 7. Lap detection algorithm

Lap detection produces:

- A list of laps with start time, end time, lap index, validity flags, and
  confidence
- A list of crossing events that justify lap boundaries

### 7.1 Crossing detection

Given:

- SFL defined by two points `A` and `B` in track ENU
- A directed normal, derived from intended lap direction

For each consecutive position pair `(P_i, P_{i+1})`:

- Determine if the segment intersects the line segment AB, with tolerance
- Compute intersection time via linear interpolation on time and position

Add constraints:

- Crossing angle must be within a range of expected direction, for example
  within 60 degrees of line normal
- Speed at crossing must exceed minimum, to avoid false crossings from dithering

### 7.2 Lap candidate construction

- Sort crossings by time
- For each pair of consecutive “valid” crossings, define a lap candidate
  interval
- Validate candidate using lap time and distance constraints

### 7.3 Validation rules

Validation must be conservative to avoid inventing laps.

Key rules:

- **Minimum lap time**: derived from track size estimate or heuristics, for
  example 10 seconds minimum for 1/8 off-road
- **Maximum lap time**: for example 5 minutes, beyond which treat as a break,
  pit, or session pause
- **Minimum lap distance**: estimated from path length along the interval, must
  exceed a fraction of the median lap length if known
- **Heading consistency**: direction at crossings should be consistent across
  laps
- **Crossing multiplicity**: handle bounce, where multiple crossings occur
  within a short window due to jitter, keep the strongest and discard the rest

Recommended defaults:

- Bounce window: 1.5 seconds
- Minimum lap time: max(8 s, 0.35 \* estimated median lap time after initial
  pass)
- Maximum lap time: 180 s, configurable

### 7.4 Handling pits and pauses

Pit behaviour often creates:

- slow passes near SFL, sometimes partial crossings
- extended idle within a local region

Approach:

- If speed near crossing is below threshold, crossing is considered
  low-confidence and may be ignored
- If a lap candidate has unusually long time and low distance, classify it as a
  “pause” interval, not a lap
- If pit region is known or inferred, laps that include pit region time may be
  flagged as “pit affected”

Outputs:

- Laps include `flags`, such as `PIT_AFFECTED`, `LOW_CONFIDENCE_CROSSING`,
  `GAP_WITHIN_LAP`

### 7.5 Handling marshal repositioning and shortcuts

When the car is picked up or moved, the trajectory can jump or reverse.

Detection rules:

- If teleport events occur inside a candidate lap above threshold, mark the lap
  invalid or low confidence
- If the path length is too short relative to median lap length, mark as invalid
- If multiple crossings occur very close together and heading is inconsistent,
  discard as jitter

### 7.6 Multi-heat or multi-session files

Some exports contain multiple runs.

Approach:

- Detect large idle gaps or large time discontinuities
- Split into “stints”
- Run lap detection per stint

This must be disclosed in UI as multiple stints.

### 7.7 Output schema for laps

Each lap record must include:

- `lap_index` starting from 1 within stint
- `stint_index`
- `t_start`, `t_end`
- `lap_time_s`
- `distance_m` along trajectory
- `validity`: valid, invalid, unknown
- `confidence`: High, Medium, Low
- `reasons`: list of reason codes
- `crossing_start_id`, `crossing_end_id`
- `source`: auto_detected, catalogue_default, user_defined

## 8. Segment specification

Segments represent meaningful sub-intervals within a lap. MRE supports:

- **Template-based segments** when a known track provides a segment map
- **Auto-inferred segments** when no template exists
- **User-defined segments** as overrides

### 8.1 Segment types

Base segment types:

- `straight`
- `corner`
- `sweeper` (long radius corner)
- `chicane` (multi-apex short sequence)
- `jump_section`
- `rhythm_section` (multiple jumps or bumps)
- `infield`
- `pit_lane` (optional)

Segments must also support:

- `unknown` when inference cannot confidently classify

### 8.2 Segment identity and stability

A segment has:

- `segment_id` stable within a track template, or stable within a run for
  auto-inferred segments
- A geometric definition in track coordinates, plus a time mapping per lap
- A directionality, segments should be traversed in a consistent order within a
  lap

Stability requirement:

- Across laps, segment boundaries should align within a tolerance, for example
  within 1 to 2 metres along path distance, otherwise confidence drops

### 8.3 Segment boundary representation

Represent segment boundaries using one of:

- **Arc-length fraction** along the lap trajectory, robust to time variation
- **Projected progress** along a reference centreline, if available

Preferred:

- progress along a reference centreline when a track template exists
- otherwise arc-length based boundaries relative to lap start

Store boundaries as:

- `s_start_m`, `s_end_m` along lap distance
- plus corresponding time ranges `t_start`, `t_end` per lap

### 8.4 Template-based segments

If the track catalogue includes a segment map:

- Use it as the primary segmentation
- Map lap trajectory to template using nearest-neighbour projection onto a
  reference polyline or centreline
- Derive `s` progress and assign segment ids

Quality checks:

- If alignment residuals are high, fall back to auto-inferred segments or mark
  segments low confidence
- Store alignment stats and reason codes like `TRACK_TEMPLATE_MISMATCH`

#### 8.4.1 Wrong track or catalogue mismatch

When the user assigns a track that does not match the session trajectory, or
the catalogue track layout differs materially from the driven path:

- **Reason code:** `TRACK_CATALOGUE_MISMATCH`
- **Behaviour:** Degrade segment confidence to Low; fall back to
  auto-inferred segments only. Do not use template segment names or boundaries.
- **UI:** Show "Assigned track does not match session path; using inferred
  segments" and offer to clear track assignment or choose a different track.
- **Avoid:** Do not silently apply a mismatched template; it produces
  misleading segment labels and metrics.

### 8.5 Auto-inferred segments

Auto inference must be conservative. The goal is to provide useful structure
without pretending to know the track layout perfectly.

Core strategy:

- Compute curvature over the lap path using smoothed trajectory
- Identify corner candidate regions as contiguous spans where curvature exceeds
  a threshold
- Identify straight regions where curvature is below a threshold and speed tends
  to be higher
- Identify jump sections using vertical signatures or speed and acceleration
  anomalies, if available

#### 8.5.1 Curvature computation

Given local ENU position series:

- Estimate heading from position differences or use yaw if available
- Compute curvature as change in heading per unit distance

Use robust estimation:

- ignore points flagged as outliers
- require minimum sample density

#### 8.5.2 Corner grouping into segments

- Detect curvature peaks and group nearby peaks into corner regions
- Merge regions separated by small straight gaps, to represent sweepers or
  complex corners
- Split regions that contain clear multi-apex patterns if stable across laps

#### 8.5.3 Naming for auto segments

Auto segments must not pretend to know real corner names unless a template
exists.

Use names like:

- `Corner 1`, `Corner 2`, ordered by occurrence after SFL
- `Straight 1`, `Straight 2`
- `Jump Section 1`

If a template exists, use template names.

### 8.6 Segment output schema

Each segment definition includes:

- `segment_id`
- `segment_name`
- `segment_type`
- `source`: template, auto, user
- `geometry`: optional region polygon or polyline in track coords
- `order_index` within lap
- `confidence` and `reasons`

Each lap includes segment instances with:

- `lap_index`, `segment_id`
- `t_start`, `t_end`, `duration_s`
- `s_start_m`, `s_end_m`
- flags, for example `GAP_WITHIN_SEGMENT`, `LOW_ALIGNMENT`

## 9. Corner detection specification

Corner detection is a combination of:

- identifying corner regions
- computing consistent corner metrics
- aligning corners across laps for comparison

### 9.1 Corner definitions

A corner is a segment region where:

- curvature magnitude exceeds threshold for a sustained distance
- the path direction changes significantly, for example at least 20 degrees
- speed often reduces relative to nearby straights, but this is optional

Corner categories:

- `hairpin`, `medium`, `fast`, based on curvature and speed profile
- `left`, `right`, based on sign of curvature
- `multi_apex`, based on multiple curvature peaks within one region
- `sweeper`, based on long corner length and moderate curvature

These are inferred labels, must be disclosed as inferred with confidence.

### 9.2 Apex and keypoints

For each corner region, identify:

- `turn_in`: where curvature rises above threshold
- `apex`: maximum curvature magnitude or minimum speed point, with tie-break
  rules
- `exit`: where curvature falls below threshold and heading stabilises

Tie-break rules:

- If yaw is available, use yaw rate and yaw to stabilise apex selection
- If only position is available, use curvature peak with smoothing

### 9.3 Corner alignment across laps

Alignment must be robust to small changes in line and noise.

Methods:

- Arc-length based alignment within the lap
- If template exists, use centreline progress alignment

Stability checks:

- Apex positions across laps should cluster tightly, otherwise corner confidence
  drops
- If the driver takes different lines, alignment tolerance must allow some
  variation, but wide spread indicates that corner boundary detection is
  unstable

### 9.4 Corner metrics prerequisites

Corner metrics depend on available signals:

If only position:

- approximate speed from position derivatives, low confidence
- curvature and path length, medium confidence at best

If velocity is available:

- better speed profile, medium confidence

If fused pose and orientation:

- better lateral acceleration estimates, higher confidence

If IMU exists:

- can estimate lateral accel more directly, but requires correct orientation,
  otherwise it is misleading

Honesty rule:

- If lateral acceleration cannot be confidently computed, do not show it, or
  show it as “estimated, low confidence” with reasons.

### 9.5 Corner output schema

Each corner record includes:

- `corner_id` (often same as segment_id when segment_type is corner)
- `corner_name`
- `direction`: left, right, unknown
- `category`: hairpin, medium, fast, sweeper, unknown
- `t_turn_in`, `t_apex`, `t_exit` per lap
- `s_turn_in_m`, `s_apex_m`, `s_exit_m`
- `confidence` and `reasons`
- `source`: template, auto, user

## 10. Jump detection integration

Off-road tracks include jumps that can disrupt corner inference and segment
boundaries.

### 10.1 Jump detection signals

Primary:

- vertical position changes if `z_u_m` is available
- vertical acceleration spikes and near-zero acceleration during flight if IMU
  is present
- speed profile anomalies, sudden changes in pitch if orientation exists

Fallback:

- repeated path patterns that include discontinuity in curvature and speed

### 10.2 Jump region behaviour

- Jump regions should be tagged and optionally separated into `jump_section`
  segments
- Corner detection inside jump regions should be suppressed or treated as low
  confidence

## 11. Confidence, quality scoring, and feature gating

Lap, segment, and corner detection outputs must include:

- confidence category
- reason codes
- linkage to task suitability scores from the quality framework

### 11.1 Lap detection confidence

High confidence requires:

- stable crossings
- low jitter around SFL
- consistent lap time distribution without excessive invalid laps
- minimal gaps and teleport events within laps

Medium:

- some gaps or jitter, minor crossing bounce, still stable lap count

Low:

- frequent gaps, inconsistent crossing directions, unstable lap lengths

### 11.2 Segment confidence

High:

- template alignment residuals low, boundaries stable across laps

Medium:

- auto inference stable, boundaries consistent, but no template

Low:

- boundaries shift significantly across laps, high curvature noise, gaps in key
  areas

### 11.3 Corner confidence

High:

- apex clustering tight, direction consistent, metrics computed from reliable
  signals

Medium:

- apex varies moderately, metrics mostly derived from position and velocity

Low:

- apex unstable, corner regions shift, or signals insufficient

### 11.4 Feature gating

Examples:

- If lap confidence is Low, show laps but disable lap-to-lap comparison, or
  require user confirmation
- If segments confidence is Low, show only template segments if available,
  otherwise hide segment screens
- If corners confidence is Low, show corners as inferred and hide advanced
  corner metrics

All gating decisions must be explainable via reason codes.

## 12. Manual overrides and user edits

User edits are supported and must be versioned and transparent.

### 12.1 Override types

- Set or adjust start/finish line
- Merge or split laps, or mark laps invalid
- Create, delete, or rename segments and corners
- Adjust segment boundaries
- Choose between raw GNSS, on-board pose, or server-fused pose as analysis
  basis, if multiple available

### 12.2 Overlay model

User edits are stored as overlays:

- never modify canonical or derived datasets in place
- a new processing run or overlay version is created
- downstream metrics recomputed using overlay definitions

### 12.3 Honesty disclosures for overrides

If user edits affect results:

- label outputs as “user-adjusted”
- show what was changed, when, and by whom
- allow revert to auto results

## 13. Determinism, configuration, and versioning

All detection components must be deterministic given:

- input trajectory and selected pose source
- smoothing configuration
- SFL definition and track template, if used
- algorithm version and parameters

Versioning requirements:

- `lap_detection_version`
- `segment_detection_version`
- `corner_detection_version`

Store configuration snapshot:

- thresholds, window sizes, bounce windows, gap thresholds
- chosen pose source

If parameters change materially, record an ADR.

## 14. Failure modes and recovery

### 14.1 When lap detection fails

Common causes:

- no valid SFL and auto detection fails
- trajectory too sparse or too noisy
- excessive gaps or teleports

Behaviour:

- Provide track path and basic charts if available
- UI shows “laps unavailable” with reasons and a prompt to define SFL
- Do not fabricate lap times

### 14.2 When segments and corners fail

Behaviour:

- Provide lap-only view if available
- If template exists but alignment fails, offer manual alignment or fallback to
  lap distance segmentation
- Corners should never be shown as certain if confidence is low

## 15. Testing strategy

### 15.1 Golden datasets

Include golden session fixtures for:

- clean multi-lap runs with stable laps
- runs with pit stops and pauses
- runs with marshal repositioning and teleports
- GNSS-only low rate sessions
- on-board fused sessions with smoother paths
- server-fused sessions with IMU data

Fixtures must be synthetic or anonymised.

### 15.2 Assertions

Lap detection:

- number of laps within expected range
- lap times stable, outliers flagged
- crossing bounce suppressed correctly

Segments:

- segment order stable across laps
- template alignment residuals within thresholds when applicable

Corners:

- direction classification stable
- apex clustering within tolerance for stable corners

### 15.3 Regression checks

- Ensure algorithm updates do not shift lap counts or lap times unexpectedly on
  golden sets
- Track and store metric deltas across versions, require explicit approval when
  deltas exceed thresholds

## 16. Implementation checklist

- [ ] Implement SFL model and crossing detection with bounce suppression
- [ ] Implement lap candidate validation rules and stint splitting
- [ ] Implement template-based segmentation using centreline projection
- [ ] Implement auto segmentation using curvature and stability across laps
- [ ] Implement corner region detection, apex extraction, and lap alignment
- [ ] Implement jump detection and suppression interactions
- [ ] Implement confidence scoring and reason codes for laps, segments, corners
- [ ] Implement user override overlay model and recomputation pipeline hooks
- [ ] Implement golden fixtures and regression harness

## 17. Future evolutions

- Learn track templates from repeated sessions using clustering, with explicit
  user opt-in
- Improve segment naming using catalogue integration and user community
  templates
- Add multi-driver and multi-car detection in shared logs
- Use higher fidelity raw GNSS metadata to improve crossing stability and corner
  confidence
- Introduce per-track calibration for thresholds based on track size and layout
  class
