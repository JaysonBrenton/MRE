# Supported Formats and Parser Specification

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define the file formats MRE will support, how parsers are structured,
how device capabilities are detected, and how raw sensors versus on-board fused
telemetry are normalised into MRE canonical streams. This includes support for
devices that require server-side Kalman filtering and devices that already
perform fusion on-board.  
License: Proprietary, internal to MRE

---

## Executive Summary

This specification defines how MRE ingests telemetry from many real-world
formats (CSV, GPX, NMEA, FIT, UBX, and vendor-specific exports) and normalises
them into a single **canonical schema** for track path, lap timing, and advanced
analysis. Support is tiered: **Level 1** (import and display), **Level 2**
(race-ready with quality scoring and downsampling), and **Level 3** (raw IMU,
time-aligned streams, and either trusted on-board fusion or server-side Kalman
fusion). Parsers are **plugins** with a strict contract: they implement
`detect()` and `parse()`, return capability maps and provenance, and run under
**safety constraints** (size limits, timeouts, no filesystem or network access).
Devices are classified by what they provide (GNSS, IMU, on-board fused pose,
etc.), and every pose stream carries **fusion provenance** (gnss_measured,
onboard_fused, or server_fused) so the product can be honest about what is
measured versus derived or estimated. The document specifies canonical units and
coordinate frames, stream types (GNSS position, IMU, pose, event, derived
kinematics), parser versioning and compatibility rules, validation and
error-handling behaviour, and test strategy. Implementation proceeds from
CSV/GPX/NMEA baseline parsers through FIT and UBX, with server-side fusion and
Kalman filter pathway defined for devices that do not provide on-board fusion.

---

## 1. Scope

This document defines:

- Supported input formats for telemetry ingestion, including what “support”
  means per format
- Parser architecture, plugin contract, versioning, and classification workflow
- Canonical stream model and required fields, units, and coordinate frames
- Handling of devices with on-board sensor fusion versus devices that provide
  raw sensors
- Requirements for server-side fusion, including a Kalman filter pathway
- Validation, error handling, recovery rules, and test requirements

Out of scope:

- Exact lap detection and racing analytics algorithms, covered elsewhere
- UI design for upload and format selection, except for required metadata
  exposure
- Vendor-specific legal and licensing constraints for proprietary formats

## 2. Design goals

- Accept real-world telemetry exports with predictable behaviour and clear
  failure reasons
- Normalise diverse formats into a stable canonical schema
- Support both fused and unfused devices with an explicit “fusion provenance”
  model
- Be honest about what is measured, corrected, derived, inferred, or estimated
- Make parsers safe to run against untrusted inputs and easy to extend

## 3. Terminology

- **Format**: File structure and encoding, for example CSV, GPX, NMEA text,
  binary.
- **Device family**: A category of devices that share an export structure and
  semantics.
- **Parser**: A plugin that reads an artifact set and outputs canonical streams
  plus metadata.
- **Classifier**: Logic that identifies candidate parsers and selects the best
  match.
- **Canonical streams**: Standard MRE internal representation for GNSS, IMU, and
  other signals.
- **On-board fusion**: Device outputs fused pose or kinematics, for example
  position plus velocity from its own filter.
- **Server-side fusion**: MRE computes fused pose from raw sensors, typically
  using a Kalman filter.

## 4. “Supported format” definition

MRE defines three support levels per format and device family:

- **Level 1, Import**  
  Parse and display track path and basic charts. Supports timestamps and
  position at minimum.

- **Level 2, Race ready**  
  Adds stable time base, unit normalisation, quality scoring signals, and
  downsampling support. Enables lap timing when data quality thresholds are met.

- **Level 3, Fusion and advanced**  
  Supports raw IMU where present, time alignment of multiple streams, and either
  trusts on-board fusion outputs with provenance or performs server-side fusion
  to produce fused pose and kinematics.

A format can be supported at Level 1 while still missing Level 2 or Level 3
features. The product must disclose this.

## 5. Input formats to support

This section lists formats as design targets. Exact vendor names are examples,
not an exhaustive or guaranteed list.

### 5.1 Text and structured formats

1. **CSV and TSV exports**  
   Common for many devices and apps. Must handle delimiter variations, header
   naming variations, locale decimal separators, and missing columns.

2. **GPX**  
   Often includes track points with time, position, and sometimes speed. Can
   include extensions for additional sensors.

3. **NMEA 0183 logs**  
   Sentence-based GNSS logs, for example GGA, RMC, VTG. Useful for low-level
   GNSS, may be higher noise and missing per-sample fields.

4. **JSON exports**  
   Some apps export JSON with nested structures, often includes device metadata
   and multiple streams.

5. **FIT (Garmin style)**  
   Common in sports telemetry. Often contains time series records. Needs careful
   mapping to GNSS and sensor fields.

### 5.2 Binary and semi-binary formats

1. **UBX (u-blox)**  
   Binary GNSS logs with rich metadata. High value for quality scoring and raw
   measurements.

2. **Vendor proprietary binary**  
   Support can be added via device-family parser plugins, typically requires
   reverse engineering or vendor documentation.

### 5.3 Multi-file artifact sets

Some devices export multiple files per session, for example:

- One GNSS file and one IMU file
- One summary file plus a high-rate raw file
- Paired video plus telemetry sidecar

MRE must treat uploads as an **artifact set**, not always a single file.

## 6. Device capability model

MRE must classify devices by what they provide, and this determines the pipeline
path.

### 6.1 Capability flags

Each parsed session must produce a capability map:

- `has_gnss_position`
- `has_gnss_velocity`
- `has_gnss_quality_fields` (DOP, fix type, sats, etc)
- `has_imu_accel`
- `has_imu_gyro`
- `has_magnetometer` (optional)
- `has_onboard_fused_pose` (position, velocity, heading, and optionally
  covariance)
- `has_onboard_fused_orientation` (roll, pitch, yaw)
- `has_time_sync_markers` (explicit sync signals or monotonic clocks)
- `sample_rate_gnss_hz`, `sample_rate_imu_hz`

### 6.2 Fusion provenance types

Every “pose” stream must carry provenance:

- `pose_source = gnss_measured`  
  Position is GNSS directly, velocity may be GNSS derived.

- `pose_source = onboard_fused`  
  Device outputs fused pose. MRE does not claim it is raw GNSS.

- `pose_source = server_fused`  
  MRE produced fused pose using its own fusion pipeline.

This provenance is mandatory for honesty, quality scoring, and debugging.

## 7. Canonical stream model

Parsers must output canonical streams that satisfy the minimum schema below.

### 7.1 Common requirements for all streams

- Timestamps must be in a single time base, UTC preferred, otherwise a monotonic
  device time with an explicit mapping to UTC if possible.
- All streams must be strictly monotonic in timestamp after `time_align` stage.
- Units must be normalised to canonical units.
- Coordinate frames must be stated and converted where needed.

### 7.2 Canonical units and coordinate frames

- Position: WGS84 latitude and longitude in degrees, altitude in metres
- Velocity: metres per second
- Acceleration: metres per second squared
- Angular velocity: radians per second
- Heading: radians, range 0 to 2pi, defined as yaw about local vertical
- Local tangent frame: ENU (east, north, up) for derived local coordinates
- Distance: metres
- Time: ISO 8601 UTC timestamp, plus optional monotonic nanoseconds

### 7.3 Stream types

#### 7.3.1 GNSS position stream, required for most features

Fields:

- `t`
- `lat_deg`
- `lon_deg`
- `alt_m` (nullable) Optional fields:
- `fix_type` (enum)
- `sat_count` (int)
- `hdop`, `vdop`, `pdop` (nullable)
- `h_acc_m`, `v_acc_m` (nullable)
- `speed_mps` (nullable)
- `course_rad` (nullable)

#### 7.3.2 IMU stream, optional but enables fusion

Fields:

- `t`
- `ax_mps2`, `ay_mps2`, `az_mps2`
- `gx_rps`, `gy_rps`, `gz_rps` Optional:
- `mx_uT`, `my_uT`, `mz_uT`
- `temp_c`

#### 7.3.3 Pose stream, optional, can be on-board fused or server-fused

Fields:

- `t`
- `x_e_m`, `y_n_m`, `z_u_m` in a defined local ENU origin
- `vx_mps`, `vy_mps`, `vz_mps` (nullable)
- `yaw_rad` (nullable), `pitch_rad` (nullable), `roll_rad` (nullable)
- `pose_source` (gnss_measured, onboard_fused, server_fused) Optional:
- `covariance` (matrix or diagonal fields)
- `confidence` or `quality` fields if provided by device

Note, if the device provides only global lat, lon, MRE can still create a local
ENU pose by choosing an origin and converting.

#### 7.3.4 Event stream, optional

For discrete events:

- `t`
- `event_type` (enum)
- `value` (nullable)
- `metadata_json` (optional)

Examples:

- lap button presses
- start marker
- pit entry marker
- device mode changes

#### 7.3.5 Derived kinematics stream, optional

If available or computed:

- `t`
- `speed_mps`
- `accel_long_mps2`, `accel_lat_mps2` (if orientation known)
- `curvature_1pm` (optional)

Derived streams must carry provenance, for example derived from onboard pose or
server-fused pose.

## 8. Parser architecture

### 8.1 High level flow

1. Intake receives an artifact set.
2. Classifier identifies candidate parsers.
3. Selected parser produces canonical streams and metadata.
4. Pipeline normalises, time aligns, down-samples, and optionally fuses.
5. Quality scoring and honesty labels are attached.

### 8.2 Parser plugin contract

Each parser is a plugin that implements:

- `id`, `name`, `version`
- `supported_extensions`, `supported_mime_types`
- `detect(artifact_set) -> detection_score, evidence`
- `parse(artifact_set, options) -> ParseResult`

Where `ParseResult` includes:

- `device_family`, `device_model` (nullable)
- `capabilities` map
- `streams` dictionary keyed by stream type
- `metadata` dictionary, for example firmware, sample rates, export app version
- `warnings` and `errors` with stable codes
- `provenance` record, including parser version

### 8.3 Detection and scoring

`detect()` must return:

- a score from 0 to 1
- evidence, for example “found header row with lat, lon, time”, “found GPX
  schema with trackpoints”, “found NMEA sentences GGA and RMC”

Classifier selects the highest score above a threshold. If no parser meets
threshold, import fails with a clear error and a “format not recognised” reason
code.

### 8.4 Parser safety constraints

Parsers run against untrusted inputs and must enforce:

- maximum file size
- maximum decompressed size if archives are supported
- timeouts and memory limits
- no filesystem writes outside a sandbox
- no outbound network access

### 8.5 Versioning and compatibility

- Every parser version is immutable once released.
- Each ParseResult records `parser_id` and `parser_version`.
- Canonical schema also has a `schema_version`.
- When canonical schema changes, parsers must be updated or adapter shims used.

Rule, older parsed runs remain reproducible, do not retroactively reinterpret
fields without reprocessing into a new run.

## 9. Normalisation rules

### 9.1 Column mapping and flexible headers

For CSV-like formats, parsers must implement a mapping layer:

- Header normalisation, lowercase, trim, replace spaces and punctuation
- Synonym mapping, for example `latitude`, `lat`, `gps_lat`
- Unit detection, for example speed in kmh versus mps
- Timestamp detection, ISO 8601, epoch seconds, epoch milliseconds

If ambiguity remains, parser must:

- choose a safe default only when evidence is strong
- otherwise fail with a clear error code and list candidate interpretations

### 9.2 Timestamp rules

Parsers must output timestamps in one of:

- UTC timestamps when available
- monotonic device time with a declared epoch mapping, if available
- otherwise, monotonic relative time, with a “no absolute time” flag

No absolute time means:

- features that rely on external data alignment, for example weather, must be
  gated
- UI must disclose “time is relative to session start”

## 10. Handling on-board sensor fusion

### 10.1 What on-board fusion typically provides

On-board fused devices may provide:

- smoothed position, velocity
- heading and orientation
- confidence estimates or covariance
- sometimes already map-matched traces

### 10.2 MRE rules for on-board fused data

- Treat on-board fused pose as a distinct stream with
  `pose_source = onboard_fused`.
- Do not claim any of it is raw GNSS.
- If raw GNSS is also present, store both streams.
- If both exist, MRE may use on-board fused for UI smoothness but must preserve
  raw for audit and quality scoring.

### 10.3 On-board fusion quality scoring

Quality scoring must consider:

- whether covariance is present
- consistency between raw GNSS and fused pose, if raw is available
- dropout behaviour, for example fused continuing through GNSS loss

If fused continues through outages, this can be valuable, but it must be
disclosed as estimated during those intervals.

### 10.4 Optional server-side smoothing on top of on-board fusion

MRE may optionally apply a light smoothing for visual downsample levels, but
must obey:

- no silent smoothing rule
- do not alter Level 0 canonical data in place
- any smoothing must be in derived datasets, not overwriting on-board pose

## 11. Handling unfused devices that require server-side fusion

### 11.1 Typical unfused device profiles

- GNSS-only at 1 to 10 Hz, no IMU
- GNSS at 10 to 25 Hz plus raw IMU at 100 to 400 Hz, time stamps may be
  unsynchronised
- IMU present but low quality or missing gyroscope

### 11.2 Fusion prerequisites

Server-side fusion requires:

- stable timestamps for both GNSS and IMU
- IMU axes and units known
- approximate gravity alignment or enough motion to infer it
- GNSS quality fields strongly preferred, but not always required

If prerequisites are not met, fusion must be skipped with a clear reason code,
and the run can still be partial.

### 11.3 Kalman filter pathway specification

MRE uses a Kalman filter, or an extended Kalman filter, for fusing IMU and GNSS
into a pose estimate.

#### 11.3.1 Inputs

- IMU stream at high rate, accel and gyro required for best results
- GNSS position and optionally velocity at lower rate
- Optional magnetometer, optional barometer
- Configuration:
  - noise parameters per device family
  - initial state uncertainty
  - gravity magnitude assumption
  - bias estimation enabled or disabled

#### 11.3.2 Outputs

- Pose stream in local ENU:
  - position, velocity
  - orientation if gyro is available
  - covariance or confidence estimates
- Fusion health metrics:
  - innovation residuals
  - divergence flags
  - time in degraded mode
  - bias estimates and their stability

All outputs must be tagged `pose_source = server_fused`.

#### 11.3.3 Time alignment and resampling rules

- IMU remains at native sample rate.
- GNSS updates are treated as measurement updates at their timestamps.
- If IMU timestamps drift relative to GNSS, MRE must estimate drift and correct
  in `time_align` stage, then fuse.

If time alignment is uncertain beyond thresholds, fusion must be skipped.

#### 11.3.4 Degraded modes

Fusion can run in modes:

- full, IMU plus GNSS
- IMU-only propagation during GNSS gaps, with increasing covariance
- GNSS-only fallback when IMU is missing or unreliable

Degraded mode must be recorded and exposed to quality scoring and UI, with clear
disclaimers.

### 11.4 GNSS-only enhancement

For GNSS-only devices, MRE can still provide:

- downsampled track path
- basic speed and acceleration derived from position differences
- lap detection if quality thresholds are met

However:

- derived acceleration and curvature are lower confidence
- UI must label them as derived and potentially noisy

## 12. Parser spec for each format family

This section defines what each parser must minimally output. These are contract
expectations, not the full mapping tables.

### 12.1 CSV-like parser family

Minimum:

- GNSS position stream with time and lat, lon
- Metadata:
  - detected delimiter
  - time format interpretation
  - column mapping evidence Optional:
- GNSS speed, course
- IMU stream if columns present
- On-board fused pose if columns indicate fused outputs

Error codes:

- `CSV_NO_TIME_COLUMN`
- `CSV_NO_POSITION_COLUMNS`
- `CSV_AMBIGUOUS_TIME_FORMAT`
- `CSV_UNSUPPORTED_ENCODING`

### 12.2 GPX parser family

Minimum:

- GNSS position stream from trackpoints
- Time from GPX timestamps if present Optional:
- speed if provided in extensions
- device metadata if available Warnings:
- `GPX_MISSING_TIME`, if timestamps missing, session time becomes relative index

### 12.3 NMEA parser family

Minimum:

- GNSS position stream from RMC or GGA Optional:
- fix type and satellites from GGA
- speed and course from RMC or VTG Limitations:
- sample rate can be low, jitter high
- no IMU Disclosures:
- likely reduced lap and comparison suitability

### 12.4 FIT parser family

Minimum:

- position and time records if present Optional:
- speed, cadence-like fields, device-specific sensors Complexity:
- message types vary, must map record messages to canonical series Warnings:
- `FIT_POSITION_SPARSE`, if position intervals are large

### 12.5 UBX parser family

Minimum:

- GNSS position with high fidelity Optional:
- rich quality fields, DOP, accuracy estimates
- raw measurements if needed for advanced processing later Security:
- strict bounds checking, binary parsing safety

## 13. Format-specific honesty and provenance rules

Parsers must tag each field with an origin class:

- measured, corrected, derived, inferred, estimated

Examples:

- GPX lat, lon, measured
- speed computed from position deltas, derived
- heading from on-board fused pose, onboard_fused, derived or measured depending
  on device documentation, default to derived unless explicit
- server-fused yaw, estimated, with confidence

If unsure whether a value is measured or derived by the device, treat it as
derived and disclose uncertainty.

## 14. Validation and error handling

### 14.1 Validation stages

1. Structural validation: file parseable, schema consistent
2. Semantic validation: fields are plausible, timestamps monotonic after fixes
3. Physics plausibility: impossible jumps, unrealistic acceleration spikes,
   teleport detection

### 14.2 Recovery rules

Parsers may attempt limited recovery:

- skip malformed rows with a warning, only if the remaining data is still valid
- repair obvious timestamp units, seconds vs milliseconds, only when unambiguous
- fill small gaps, only in derived datasets, and disclose

Parsers must not silently fabricate data to fill large gaps.

### 14.3 Error reporting contract

Errors must include:

- stable `error_code`
- human-readable message
- evidence, for example which columns missing, which sentence types absent
- user action hint, for example “export as GPX with timestamps enabled”

## 15. Test strategy

### 15.1 Golden fixtures

For each parser family:

- include at least 5 golden fixtures:
  - clean file
  - missing optional fields
  - corrupted row
  - ambiguous time format
  - multi-file artifact set if applicable

Fixtures must be small and safe, no personal telemetry.

### 15.2 Property-based tests

- timestamp monotonicity after normalisation
- unit conversions correct within tolerance
- no NaNs or infinities in canonical streams
- parser does not crash on random bytes, for binary formats

### 15.3 Regression checks for quality scoring impacts

- ensure a parser version change does not silently downgrade scores beyond
  allowed bands without an intentional change record

## 16. Operational considerations

### 16.1 Parser rollout

- new parser versions deployed behind a feature flag
- canary on small percentage of uploads
- monitor failure rates and quality score distributions

### 16.2 Observability

Per parse attempt record:

- input bytes
- parse duration
- rows produced per stream
- warnings count and top warning codes
- error codes

Do not log raw coordinates or raw sensor values.

## 17. Implementation checklist

- [ ] Define canonical schema version 1, including stream field sets and units
- [ ] Implement parser plugin interface, detect and parse, plus evidence
      reporting
- [ ] Implement classifier with score thresholding and tie-break rules
- [ ] Implement CSV, GPX, and NMEA parsers first as baseline
- [ ] Add FIT and UBX parsers next, with strict safety constraints
- [ ] Implement capability map and pose provenance types
- [ ] Implement server-side fusion module interface and Kalman filter pipeline
      hooks
- [ ] Add golden fixtures and property-based tests
- [ ] Add disclosure labels and provenance in API responses and exports

## 18. Future evolutions

- Support video plus telemetry sidecar formats, sync via time markers
- Add raw GNSS measurement support for advanced RTK and PPP workflows
- Device family profiles to auto-tune noise parameters for Kalman fusion
- User-driven format overrides when classification is uncertain, with clear
  honesty disclaimers """
