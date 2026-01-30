# User Story: Universal Telemetry Import and Analysis (GNSS + IMU)

## Summary

MRE must let users upload telemetry from many devices and formats, automatically
detect what is present (GNSS format and IMU axis level), normalise it into
canonical streams, run fusion and analytics where possible, and present fast,
useful driving insights.

## User story

As a race driver or analyst,  
I want to upload telemetry logs from any GNSS and IMU device (RINEX,
Hatanaka/CRINEX, BINEX, UBX, NMEA, CSV),  
so that MRE automatically detects the formats, normalises the data, fuses GNSS
and IMU when possible, and produces lap and driving insights I can review and
compare.

## Primary persona

- Driver, team manager or team members reviewing a run and looking for lap time
  improvement opportunities.

## Assumptions (so we can ship a complete vertical slice)

- Users upload logs after a run (batch processing), not necessarily live
  streaming.
- Inputs may contain:
  - GNSS PVT (solved positions) and or GNSS raw observations
  - IMU accel only, accel plus gyro, accel plus gyro plus mag
- Not all uploads include enough data for all analytics, MRE must be explicit
  about what was detected and used.
- MRE stores both raw uploads and processed outputs with provenance (hashes,
  parser versions, algorithm versions).

## Functional requirements

### Import and detection

- Users can upload one or more files into a new telemetry session.
- MRE detects file types and compression, then parses into canonical internal
  streams:
  - `GNSS_PVT` if solved position data exists
  - `GNSS_RAW_OBS` if raw satellite observations exist
  - `IMU` with capability flags: accel, gyro, mag
- MRE shows detected capabilities in the UI.

### Processing and analysis

- MRE generates:
  - Track map for the session
  - Lap segmentation and lap timeline
  - Per lap metrics
  - Event markers (corners, braking, jumps, impacts) when feasible from data
- MRE runs fusion when gyro is present:
  - 6 axis fusion if accel plus gyro
  - 9 axis fusion if accel plus gyro plus mag, with mag gating
  - If accel only, MRE does not claim orientation yaw from IMU

### Performance and UX

- UI charts and maps must load quickly by using downsampled data by default.
- Processing runs as background jobs with visible progress and failure reasons.

### Export

- Users can export processed outputs:
  - Canonical streams (PVT, IMU, fused trajectory)
  - Derived metrics (per lap, per segment)
  - Provenance metadata

## Acceptance criteria (Given, When, Then)

### AC1: Create telemetry session

Given I am signed in,  
When I upload one or more telemetry files,  
Then MRE creates a new telemetry session and shows an import job status.

### AC2: Format detection is automatic and visible

Given I upload files of mixed types (for example UBX plus CSV),  
When processing starts,  
Then MRE identifies each file type (RINEX, CRINEX, BINEX, UBX, NMEA, CSV) and
shows the detection result.

### AC3: IMU axis capability detection is automatic

Given I upload telemetry that includes IMU fields,  
When processing completes,  
Then MRE reports IMU capability as one of:

- accel only (3 axis observed)
- accel plus gyro (6 axis observed)
- accel plus gyro plus mag (9 axis observed)

### AC4: Canonical streams are produced

Given processing completes successfully,  
When I view the session details,  
Then MRE shows which canonical streams exist:

- GNSS PVT available or not
- GNSS raw observations available or not
- IMU available or not
- Fused trajectory available or not

### AC5: Track map and laps always appear when GNSS PVT exists

Given GNSS PVT exists for the session,  
When I open the session,  
Then I can see a track map and lap timeline.

### AC6: Fusion behaviour is correct and honest

Given the session includes accel plus gyro,  
When I view the fused trajectory,  
Then MRE uses 6 axis fusion and labels heading sources (GNSS course at speed,
gyro integration between updates).

Given the session includes accel plus gyro plus mag,  
When I view the fused trajectory,  
Then MRE uses 9 axis fusion and only uses magnetometer when quality gates pass,
otherwise it falls back to GNSS course.

Given the session includes accel only,  
When I view any heading or yaw outputs,  
Then MRE does not claim IMU derived yaw, and labels heading as GNSS derived
only.

### AC7: Core per lap metrics exist

Given GNSS PVT exists for the session,  
When processing completes,  
Then MRE computes at least:

- lap time
- average speed
- max speed
- distance travelled per lap

And if IMU exists, MRE also computes where feasible:

- peak lateral acceleration estimate
- braking event count
- jump or impact events

### AC8: Fast visualisation via downsampling

Given a session contains high rate IMU data,  
When I view charts at the session level,  
Then MRE loads downsampled data automatically and the UI remains responsive.

### AC9: Job failure is actionable

Given a job fails,  
When I open the session,  
Then MRE shows a clear failure reason and which file caused it, and retains the
raw artifacts.

### AC10: Export works

Given processing completes,  
When I export the session outputs,  
Then I receive canonical streams and derived metrics plus provenance metadata.

## Telemetry and audit requirements

- Emit events for:
  - upload_created, upload_parsed, job_started, job_succeeded, job_failed
  - detected_gnss_type, detected_imu_capabilities
  - fusion_mode_selected, mag_rejected_due_to_quality
- Store provenance:
  - input artifact hashes
  - parser version
  - fusion algorithm version
  - configuration parameters used

## Open questions (answer later, does not block this story)

1. Do we need live streaming ingestion in the near term, or is batch import
   enough for the next milestone?
2. What is the minimum set of per lap and per segment metrics you want in the
   first analysis dashboard?
3. Should users be able to manually override detected coordinate frame (X
   forward, Y left, Z up) when a device uses a different convention?
4. Do you want raw observation processing (RTK/PPK/PPP) to run automatically
   when raw obs are present, or only on demand?
5. What retention policy should apply to raw uploads and processed time series
   for different account tiers?
