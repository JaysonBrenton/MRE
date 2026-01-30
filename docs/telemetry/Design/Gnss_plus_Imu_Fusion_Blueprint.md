# MRE Blueprint: GNSS and IMU Ingestion, Normalisation, Fusion (3, 6, 9 Axis) + Multi Format Support

## Audience

This document is written for readers who may not know GNSS or IMU terminology.
It explains the concepts first, then provides a practical implementation
blueprint for MRE.

## Goal

MRE must ingest and use telemetry from many device types and file types.

At runtime, we might receive:

- GNSS archive formats: RINEX, Hatanaka (CRINEX), BINEX
- GNSS serial stream logs: NMEA, u-blox UBX (and possibly RTCM in some cases)
- Solution style logs: CSV with latitude, longitude, speed, heading, plus
  optional IMU fields

And at runtime we might have an IMU with:

- 3 axis (accelerometer only)
- 6 axis (accelerometer + gyroscope)
- 9 axis (accelerometer + gyroscope + magnetometer)

We do not know the device capabilities until we parse the input.

MRE should produce consistent outputs for the rest of the app:

- A unified time series of position, velocity, heading
- A unified time series of IMU data in consistent units and coordinate frames
- A unified fused trajectory when feasible
- Confidence indicators that are honest about data quality

## Scope

This blueprint is written to support a fully fledged telemetry analysis system.
It defines an architecture that can ingest, normalise, store, and analyse
multiple GNSS and IMU data sources, and it enables advanced processing paths
(including high precision GNSS and streaming) without redesign.

Key outcomes required by this blueprint:

- Support multiple GNSS input types at runtime, including RINEX, Hatanaka
  (CRINEX), BINEX, and serial message logs (NMEA, UBX), plus solution style CSV.
- Support multiple IMU axis levels at runtime, including 3 axis, 6 axis, and 9
  axis.
- Provide canonical internal data models so the rest of MRE does not care about
  original file formats.
- Persist raw artifacts and normalised streams for replay, debugging, and future
  algorithm upgrades.
- Produce consistent telemetry outputs and confidence indicators for analysis
  and visualisation.

There are no stated limitations in this document. Where the implementation plan
is phased, that sequencing is about delivery order, not capability exclusion.

---

# Big Picture

## Two independent inputs, one combined timeline

Think of MRE data as two streams:

1. GNSS stream

- Tells you where you are and how fast you are moving, at low to medium update
  rate.
- Comes as either:
  - Solution level GNSS (PVT), easy to use
  - Raw observations, more complex, supports high precision processing

2. IMU stream

- Tells you how the device moves and rotates, at high update rate.
- The axis level determines how much it can help.

Fusion is optional, but when available it improves smoothness, orientation, and
short term motion between GNSS points.

---

# Glossary (Plain English)

| Term              | Plain English meaning                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| GNSS              | Global Navigation Satellite System, satellites that help a device work out where it is. GPS is one example.     |
| IMU               | Inertial Measurement Unit, sensors that measure movement and rotation.                                          |
| Axis              | A direction component, X, Y, and Z. 3 axis means the sensor measures all three directions.                      |
| 3 axis IMU        | Accelerometer only, measures acceleration and gravity in X, Y, Z.                                               |
| 6 axis IMU        | Accelerometer plus gyroscope, measures acceleration and rotation rate in X, Y, Z.                               |
| 9 axis IMU        | Accelerometer plus gyroscope plus magnetometer, adds a compass like sensor in X, Y, Z.                          |
| Accelerometer     | Measures acceleration and gravity. Useful for bumps, jumps, and tilt.                                           |
| Gyroscope         | Measures how fast the device is rotating. Useful for smooth heading and orientation changes.                    |
| Magnetometer      | Measures Earth magnetic field direction, helps with compass heading, but can be disturbed by motors and wiring. |
| PVT               | Position Velocity Time, solved GNSS output: where you are, how fast you are moving, and time.                   |
| Raw observations  | Raw satellite measurements used for high precision processing.                                                  |
| RINEX             | A common text file format for GNSS data exchange.                                                               |
| Hatanaka (CRINEX) | A lossless compressed form of RINEX observation data.                                                           |
| BINEX             | A binary GNSS exchange format, compact but not human readable.                                                  |
| NMEA              | A text based GNSS serial message format, often used by hobby modules.                                           |
| UBX               | A u-blox binary message format, can include solved output and raw measurements if configured.                   |
| RTCM              | A binary message format commonly used for GNSS correction data.                                                 |
| Serial stream     | Data that arrives as continuous messages over UART, USB, or Bluetooth rather than as a pre made file.           |
| Normalisation     | Converting different inputs into one consistent internal representation, including units and time.              |
| Coordinate frame  | A definition of X, Y, Z directions, for example X forward, Y left, Z up.                                        |
| Time base         | The clock reference used for timestamps, must be consistent for fusion.                                         |
| Sensor fusion     | Combining GNSS and IMU to estimate a smoother, more accurate trajectory and orientation.                        |
| Kalman Filter     | A method to combine noisy measurements with a model to estimate the most likely state.                          |
| EKF               | Extended Kalman Filter, used when the model is non linear, like 3D orientation.                                 |
| Quaternion        | A stable way to represent 3D orientation without gimbal lock.                                                   |
| Bias              | A sensor offset or drift, for example a gyro reading a small rotation rate when still.                          |
| ZUPT              | Zero velocity update, when stationary we force velocity to zero to reduce drift.                                |

---

# Design Principles

1. Canonical internal models All inputs become one of these streams:

- GnssPvtStream: solved position, velocity, heading
- GnssRawObsStream: raw satellite measurements
- ImuStream: accel, gyro, mag as available

2. Capability driven behaviour We never assume sensor availability. We infer it
   from parsed content.

3. Mode switching is additive One fusion engine, with measurement updates
   enabled or disabled based on capability.

4. Quality is explicit Every output carries uncertainty and quality flags.

5. Store both raw and normalised Always retain original uploads for replay and
   debugging.

---

# Data Contracts (Internal Types)

## 1) Canonical GNSS PVT

Minimum fields required for useful racing features:

- t: timestamp (float seconds or int nanoseconds)
- lat, lon, alt
- velN, velE, velD (or speed + course)
- course (heading from motion)
- accuracy indicators if present

## 2) Canonical GNSS Raw Observations

Minimum fields required for later precision workflows:

- t
- per satellite observables, include what is present:
  - pseudorange
  - carrierPhase
  - doppler
  - cn0

- constellation and satellite id

## 3) Canonical IMU

- t
- accel: ax, ay, az (m/s^2)
- gyro: gx, gy, gz (rad/s) optional
- mag: mx, my, mz (microtesla) optional
- frame: body frame definition used after mapping

## 4) Fused Output

- t
- position, velocity
- orientation (quaternion)
- derived racing metrics (optional later): lateral g, braking, jump detection,
  corner segmentation
- uncertainty: covariance summary or simplified scalars
- mode flags: accel only, imu6, imu9

---

# Input Detection and Parsing Blueprint

## Step 0: Identify input kind

Given an uploaded file or stream log, we determine:

- Is this a text file or binary file
- Does it look like CSV, NMEA, RINEX, CRINEX, UBX, BINEX
- Is it compressed (gzip, Z)

### Practical detection rules

- CSV: first line contains comma separated column names, consistent number of
  commas per line
- NMEA: lines starting with $ and ending with checksum \*hh
- RINEX: header contains “RINEX VERSION / TYPE”
- Hatanaka: header contains “COMPACT RINEX FORMAT” or “CRINEX VERS / TYPE”,
  often also compressed
- UBX: binary, 0xB5 0x62 sync bytes
- BINEX: binary, requires record framing, do not rely on filename alone
- Gzip: 0x1F 0x8B

## Step 1: Decompress if needed

- .gz decompress
- .Z decompress

## Step 2: Parse into canonical streams

- If RINEX obs or CRINEX -> GnssRawObsStream
- If BINEX -> decode to GnssRawObsStream (or convert to RINEX then parse)
- If UBX -> decode messages
  - NAV-PVT -> GnssPvtStream
  - RXM-RAWX and related -> GnssRawObsStream

- If NMEA -> GnssPvtStream from key sentences
- If CSV -> detect columns
  - If it has lat, lon, speed, course -> GnssPvtStream
  - If it has accel or gyro columns -> ImuStream

## Step 3: Infer capabilities

From parsed streams:

- GNSS capability:
  - hasPvt
  - hasRawObs

- IMU capability:
  - hasAccel
  - hasGyro
  - hasMag

Then assign a fusion mode:

- accel only if hasAccel and not hasGyro
- imu6 if hasAccel and hasGyro and not hasMag
- imu9 if hasAccel and hasGyro and hasMag

---

# Time Alignment Blueprint

## Single timeline

Choose a single time scale internally.

- Recommended: GNSS time or UTC in nanoseconds since epoch, but be consistent.

## Alignment strategy

- IMU typically runs at 50 to 1000 Hz
- GNSS PVT often runs at 1 to 20 Hz

Approach:

- Run prediction at IMU rate when gyro is available
- Apply GNSS updates when a GNSS sample arrives
- If IMU only accel, do not rely on prediction for navigation, use GNSS as the
  primary timeline and attach accel samples via interpolation or nearest
  neighbour.

---

# Fusion Engine Blueprint

## Overview

Implement an error state Extended Kalman Filter (ES EKF) with:

- a nominal state propagated using IMU (when gyro present)
- a covariance of small errors
- measurement updates from GNSS and optional magnetometer

This produces a smooth trajectory and orientation.

## State definition

Nominal state:

- position p (ECEF or local tangent plane)
- velocity v
- orientation q (quaternion)
- biases:
  - accel bias b_a (3)
  - gyro bias b_g (3) if gyro exists
  - mag bias b_m (3) optional

Error state contains small errors around nominal, used in EKF update.

## Process model

### If gyro and accel exist (6 or 9 axis)

Prediction uses strapdown integration:

- integrate gyro to update q
- rotate accel into navigation frame, subtract gravity, integrate v
- integrate v to update p

Covariance propagation uses sensor noise and bias random walk.

### If only accel exists (3 axis)

Do not run strapdown INS.

- Use GNSS to drive position and velocity.
- Use accel mainly for:
  - event detection (bumps, jumps)
  - roll and pitch estimation only when acceleration magnitude is near 1g
  - stationary detection

Optional simplified filter for 3 axis mode:

- A GNSS smoothing filter (Kalman) on position and velocity
- Accel can help refine vertical dynamics and detect shocks, not orientation
  yaw.

## Measurement updates

### GNSS position update

- Compare predicted position to GNSS position
- Update p and reduce drift

### GNSS velocity update

- Compare predicted velocity to GNSS velocity (from Doppler or derived)
- Update v and help stabilise heading

### Course over ground update (PVT heading)

- When speed is above threshold, GNSS course gives yaw reference
- Update yaw component of orientation

### Magnetometer update (9 axis)

- Use mag to constrain yaw when quality gates pass
- Quality gates:
  - magnitude within expected Earth field range for region
  - low variance over short window
  - no sudden spikes indicating interference

- When gates fail, ignore mag and rely on GNSS course instead

### ZUPT update

- If the vehicle is stationary, set velocity to zero with high confidence
- Stationary detection:
  - gyro near zero for a window
  - accel magnitude near 1g and low variance
  - GNSS speed near zero

ZUPT is powerful for reducing drift.

---

# Feature Behaviour by IMU Axis Level

## 3 axis (accelerometer only)

What you can reliably deliver:

- Good track map from GNSS
- Lap timing
- Bump and jump detection
- Basic g force features

What you cannot reliably deliver:

- Smooth orientation
- Accurate yaw rate
- Dead reckoning between GNSS outages

UI guidance:

- Show “IMU mode: Accelerometer only, heading from GNSS”

## 6 axis (accel + gyro)

What you can deliver:

- Smooth trajectory between GNSS updates
- Better corner segmentation
- Yaw rate estimation for driving analysis

Limitations:

- Yaw drifts slowly without reference, but GNSS course updates at speed fix it.

UI guidance:

- Show “IMU mode: 6 axis, yaw corrected by GNSS course when moving”

## 9 axis (accel + gyro + mag)

What you can deliver:

- Better low speed heading
- Better orientation continuity

Limitations:

- Magnetometer interference near motors and batteries

UI guidance:

- Show “IMU mode: 9 axis, mag used only when clean”

---

# Storage Blueprint

## Store raw artifacts

- Store original upload bytes
- Store metadata: filename, hash, detected type, parse version

## Store normalised streams

- GNSS PVT samples
- GNSS raw obs samples, if present
- IMU samples

## Store fused output

- Fused trajectory samples
- Quality flags and uncertainties

## Versioning

- Every parse and fusion run should record:
  - parser version
  - fusion algorithm version
  - configuration used

This allows replay when algorithms improve.

---

# Runtime Decision Tree

1. Ingest file or stream log
2. Detect type and decompress if needed
3. Parse into canonical streams
4. Infer capabilities
5. Choose processing path

### If only GNSS PVT exists

- Provide racing features from PVT
- If IMU exists, add IMU based features
- Fusion optional, can still smooth trajectory with a PVT only filter

### If GNSS raw obs exists

- In v1: optionally derive a PVT like stream using an external solver, or
  postpone
- In v2: add solver integration for PPK or RTK

### If gyro exists

- Enable ES EKF propagation at IMU rate

### If mag exists

- Enable mag update with quality gates

---

# Implementation Plan (Phased)

## Phase 1: Canonical parsing and racing outputs

- Implement input sniffing and parsing for:
  - CSV PVT
  - NMEA PVT
  - UBX NAV-PVT

- Implement IMU parsing for accel and gyro fields when present
- Produce unified PVT stream
- Add confidence flags based on GNSS quality fields when available

Deliverables:

- Upload, detect, parse, store
- Visualise track and laps

## Phase 2: 6 axis fusion (practical sweet spot)

- Implement ES EKF for accel + gyro + GNSS PVT
- Use GNSS velocity and course for yaw stabilisation at speed
- Add ZUPT detection for pit lane or stopped states

Deliverables:

- Fused trajectory smoother than raw GNSS
- Better corner detection

## Phase 3: 3 axis support

- Add accel only mode:
  - GNSS driven smoothing
  - accel event detection
  - roll and pitch only in low dynamics

Deliverables:

- Honest outputs, no fake yaw

## Phase 4: 9 axis support

- Add magnetometer updates with interference gating
- Add calibration workflow if needed

Deliverables:

- Better low speed heading

## Phase 5: Raw observation formats

- Add RINEX parsing for observations
- Add Hatanaka decompression and conversion to RINEX
- Add BINEX decoding or conversion to RINEX
- Decide solver strategy:
  - external tool integration first
  - internal solver later if needed

Deliverables:

- Optional high precision pipeline

---

# Testing Blueprint

## Parser tests

- Golden files for each input kind
- Ensure detection, decompression, parsing produce consistent canonical streams

## Fusion tests

- Simulated motion with known truth
- Regression tests using recorded logs
- Validate that mode switching works:
  - 3 axis does not claim yaw from IMU
  - 6 axis drifts without GNSS but corrects with course updates
  - 9 axis ignores mag when corrupted

## Performance tests

- Measure parse throughput for large logs
- Measure fusion runtime for 10 minute sessions at high IMU rate

---

# Operational Notes

## Honest UI

Always show:

- What data types were detected
- What IMU axes are present
- What fusion mode is active
- Whether heading is from GNSS, gyro integration, or magnetometer

## Error handling

- If raw observation data exists but no solver configured, store it and show
  “raw observations detected, processing not enabled”.
- If timestamps are inconsistent, warn and fall back to nearest neighbour
  alignment.

---

# Appendix: Practical examples of what users upload

1. RaceBox style CSV

- Often includes PVT plus g force and rotation rates
- This is already solved data, not RINEX

2. Hobby GNSS module log

- Often NMEA or UBX
- May include only NAV-PVT, or may include raw measurements if configured

3. Professional data archive

- Often RINEX obs, possibly Hatanaka compressed

4. Survey style dataset

- May provide BINEX

---

# Summary

- RINEX, Hatanaka, BINEX are file oriented exchange formats, often raw
  observation level.
- NMEA and UBX are serial message protocols, often solution level, sometimes raw
  obs.
- IMU axis level determines how much the IMU can improve motion and heading.
- MRE should normalise everything into canonical GNSS and IMU streams, infer
  capabilities, then run a fusion engine that enables measurement updates based
  on what exists.
- Start with PVT and 6 axis fusion, then expand to 3 axis, 9 axis, then raw obs
  formats.
