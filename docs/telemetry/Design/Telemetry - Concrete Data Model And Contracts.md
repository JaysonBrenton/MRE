# MRE Telemetry: Concrete Data Model and Contracts

created: 2026-01-30 creator: Jayson Brenton purpose: Define an
implementation-ready data model and integration contracts for telemetry ingest,
storage, processing, and query. This spec is designed to fit the existing MRE
Postgres plus Prisma schema, and introduce a dedicated high-performance
time-series store. status: Draft v1

**Storage authority:** Parquet is canonical; ClickHouse is a derived cache. See
`docs/adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md`.

## 1. Scope

This document defines:

- The **telemetry domain entities** and their relationships.
- The **Postgres schema** for telemetry metadata and governance.
- The **time-series storage schema** for high-rate samples and derived streams.
- The **contracts** between UI, API, and processing workers for ingest,
  processing, and query.
- Rules for **idempotency**, **versioning**, **immutability**, and **deletion**.

This document does not define:

- UI designs or screen flows (covered by your UX docs).
- Algorithm details (covered by GNSS plus IMU fusion blueprint), except where
  required for versioning and reproducibility.

## 2. Design goals and constraints

### 2.1 Primary goals

- **Fast interactive analysis** for typical MRE flows, session overview, lap
  list, lap compare, segment charts.
- **Reproducibility**, every derived output must be attributable to specific
  inputs and processing versions.
- **Idempotent ingest**, repeated uploads do not create duplicate sessions or
  duplicate time-series rows.
- **Deletion correctness**, private by default, shareable to team and optionally
  public.

### 2.2 Storage and performance assumptions

- Telemetry sessions can include **multiple uploads per session** (GNSS file
  plus IMU file, or multiple devices).
- Raw uploads are **discarded after canonicalisation**.
- Track catalogue is in Postgres and updated daily from LiveRC, telemetry
  sessions can be assigned to a known track.

### 2.3 Identifier strategy

All telemetry entity IDs (sessions, processing runs, artifacts, datasets, etc.)
are **UUIDs**. Store and expose UUIDs without type prefixes. See
`docs/adr/ADR-20260131-telemetry-identifier-strategy.md`.

## 3. High level storage architecture

### 3.1 Postgres, metadata and governance

Postgres remains the system of record for:

- Users, drivers, teams, sharing policy.
- Telemetry sessions, artifacts, processing runs, derived dataset catalogue.
- Track assignment, lap and segment metadata, user edits, audit.

### 3.2 Time-series store, high-rate samples

**Parquet in object storage is canonical.** **ClickHouse** is a derived,
rebuildable cache for interactive queries. See
`docs/adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md`.

Rationale for ClickHouse as the query cache:

- ClickHouse is optimised for high ingestion and fast analytical queries over
  large columnar time series, and its MergeTree family supports ordering and
  partitioning patterns that match time-window and per-session access.
  ([clickhouse.com](https://clickhouse.com/docs/best-practices/choosing-a-primary-key))
- Prisma does not natively support ClickHouse, so ClickHouse access will be via
  a separate client in the API and workers.
  ([github.com](https://github.com/prisma/prisma/issues/16174))

Notes:

- Postgres remains the join hub for business entities.
- ClickHouse stores only time-series and derived sample streams, not
  authoritative ownership or sharing rules.

## 4. Identity, driver, team, and sharing model

### 4.1 User and Driver

You stated:

- Single login account.
- Account is linked to a single Driver.

In the current MRE schema, the **User** model already contains `driverName`, and
there is a `DriverProfile` model for user-defined driver profiles.

Telemetry will treat:

- **User** as the canonical owner identity.
- A session is associated to exactly one **Driver identity**, defaulting to the
  owning User, optionally referencing a `DriverProfile` for display and
  transponder preferences.

### 4.2 Teams

You stated:

- A driver can be a member of a team.
- A team has a team manager.

The existing schema has `teamName` and `isTeamManager` on User, which is not
sufficient for membership and access control at scale.

Add explicit team models for telemetry sharing, while keeping existing User
fields for backwards compatibility:

- **Team**: a named group.
- **TeamMember**: a membership join with role.

Roles:

- `MANAGER`
- `MEMBER`

### 4.3 Sharing

Default privacy is private. Sessions may be shared:

- To a Team (all members can view, managers can administer).
- Public, via a share token link.

Sharing is governed in Postgres using explicit grants, and enforced by the API.
Time-series data is retrieved from ClickHouse only after Postgres authorisation
passes.

## 5. Core telemetry concepts

### 5.1 Session

A telemetry **Session** is the top-level container for:

- A set of uploads (artifacts).
- A time range (start, end).
- An assigned track (optional until user assigns).
- A set of derived outputs (processing runs).
- Lap structure derived from start/finish crossing.

### 5.2 Artifact

An **Artifact** is a single uploaded file (or upload part) used as input to
processing.

Raw file bytes are discarded after canonicalisation, but the metadata and
checksum remain for audit and idempotency.

### 5.3 ProcessingRun

A **ProcessingRun** is an immutable execution of the pipeline for a session.

- It references inputs, pipeline versions, and produces outputs.
- A session can have multiple runs, only one is marked as current.

### 5.4 Stream and Dataset

A **Stream** is a sensor time-series, such as GNSS points, IMU samples, fused
pose.

A **Dataset** is a named, versioned output stream stored in ClickHouse with a
defined schema and sampling profile.

We separate:

- **Raw canonical streams** (after normalisation).
- **Derived streams** (fusion output, lap-aligned outputs, downsampled outputs).

## 6. Time and coordinate standards

### 6.1 Time

Canonical time rules:

- All timestamps stored in UTC.
- Store both `timestamp` and, when available, `device_time` and `clock_source`
  metadata.
- Timestamp precision:
  - Postgres metadata: microseconds.
  - ClickHouse samples: milliseconds minimum, microseconds if upstream provides
    stable microseconds.

### 6.2 Coordinate frames and units

Canonical units:

- Lat/long: WGS84 degrees.
- Altitude: metres.
- Speed: metres per second (store also km/h derived only for display).
- Acceleration: metres per second squared.
- Gyro: radians per second.

Canonical frames:

- IMU axes must be mapped into a declared frame, for example device frame to
  vehicle frame.
- Store transform metadata on the stream so that fusion is reproducible.

## 7. Postgres schema, telemetry domain

All new tables use UUID PKs, plus `createdAt`, `updatedAt`.

### 7.1 TelemetrySession

**Table:** `telemetry_sessions`

Purpose: top-level metadata and governance.

Columns:

- `id` UUID PK
- `ownerUserId` UUID FK to `users.id` (required)
- `driverProfileId` UUID FK to `driver_profiles.id` (optional)
- `trackId` UUID FK to `tracks.id` (optional until assigned)
- `name` text (optional, user label)
- `notes` text (optional)
- `privacy` enum `PRIVATE | TEAM | PUBLIC` (default `PRIVATE`)
- `startTimeUtc` timestamptz (required)
- `endTimeUtc` timestamptz (required)
- `timeZone` text (optional, capture device local tz if known)
- `primaryDeviceId` UUID FK to `telemetry_devices.id` (optional)
- `currentRunId` UUID FK to `telemetry_processing_runs.id` (optional)
- `status` enum `UPLOADING | PROCESSING | READY | FAILED | DELETED` (default
  `UPLOADING`)
- `deletedAt` timestamptz (optional)

Constraints:

- `endTimeUtc >= startTimeUtc`
- If `status = DELETED` then `deletedAt` is not null.

Indexes:

- `(ownerUserId, startTimeUtc DESC)`
- `(trackId, startTimeUtc DESC)`
- `(currentRunId)`

### 7.2 TelemetryDevice

**Table:** `telemetry_devices`

Purpose: stable identity and capability profile for data sources.

Columns:

- `id` UUID PK
- `ownerUserId` UUID FK to `users.id` (required)
- `deviceType` enum `PHONE | RACEBOX | CUSTOM | OTHER` (required)
- `make` text (optional)
- `model` text (optional)
- `serial` text (optional)
- `firmwareVersion` text (optional)

**IMU DOF support (new):**

- `capabilities` jsonb (optional but recommended), a capability profile
  discovered and stored at ingest.

Capability contract (recommended JSON shape):

- `sensors.gnss.present`: boolean
- `sensors.gnss.nominalRateHz`: number
- `sensors.imu.present`: boolean
- `sensors.imu.nominalRateHz`: number
- `sensors.imu.dof`: integer, expected values `3 | 6 | 9`
- `sensors.imu.channels`: array of strings from `{ACCEL, GYRO, MAG}`
- `sensors.imu.frame`: string from `{DEVICE, VEHICLE}`
- `sensors.imu.axisConvention`: string, for example `RH_Z_UP`, `RH_Z_DOWN`
- `sensors.imu.units`: object, for example
  `{ accel: "m/s^2", gyro: "rad/s", mag: "uT" }`
- `sensors.imu.calibration`: object, optional, for example
  `{ mag: "UNKNOWN|UNCAL|CAL", accelBias: "KNOWN|UNKNOWN" }`

Notes:

- This capability model is used to validate ingest, choose fusion behaviour, and
  guarantee reproducibility.
- If a file contains IMU data but `capabilities` is missing, the canonicaliser
  must populate a best-effort capability profile on first ingest.

Indexes:

- `(ownerUserId)`
- `(deviceType)`

### 7.3 TelemetryArtifact

**Table:** `telemetry_artifacts`

Purpose: uploaded inputs, retained as metadata only after canonicalisation.

Columns:

- `id` UUID PK
- `sessionId` UUID FK to `telemetry_sessions.id` (required)
- `ownerUserId` UUID FK to `users.id` (required)
- `deviceId` UUID FK to `telemetry_devices.id` (optional)
- `artifactRole` enum `GNSS | IMU | FUSED | MIXED | UNKNOWN` (default `UNKNOWN`)
- `originalFileName` text (required)
- `contentType` text (required)
- `byteSize` bigint (required)
- `sha256` text (required)
- `uploadedAt` timestamptz (required)
- `formatDetected` text (optional), for example `racebox_csv_v2`
- `status` enum `UPLOADED | CANONICALISED | REJECTED | DELETED` (default
  `UPLOADED`)
- `discardedAt` timestamptz (optional), when raw bytes are deleted
- `ingestWarnings` jsonb (optional)

Idempotency rules:

- Within a session, `(sha256, byteSize)` must be unique.

Indexes:

- `(sessionId, uploadedAt)`
- `(ownerUserId, uploadedAt)`
- Unique `(sessionId, sha256, byteSize)`

### 7.4 TelemetryProcessingRun

**Table:** `telemetry_processing_runs`

Purpose: immutable record of a pipeline execution.

Columns:

- `id` UUID PK
- `sessionId` UUID FK to `telemetry_sessions.id` (required)
- `status` enum `QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED` (required)
- `requestedByUserId` UUID FK to `users.id` (optional)
- `startedAt` timestamptz (optional)
- `finishedAt` timestamptz (optional)
- `pipelineVersion` text (required)
- `canonicaliserVersion` text (required)
- `fusionVersion` text (optional)
- `lapDetectorVersion` text (optional)
- `inputArtifactIds` uuid[] (required)
- `outputDatasetIds` uuid[] (optional)
- `qualitySummary` jsonb (optional)
- `errorCode` text (optional)
- `errorDetail` text (optional)

Constraints:

- A run is immutable once `status` is in `SUCCEEDED` or `FAILED`.

Indexes:

- `(sessionId, startedAt DESC)`

### 7.5 TelemetryDataset

**Table:** `telemetry_datasets`

Purpose: catalogue of time-series datasets stored in ClickHouse.

Columns:

- `id` UUID PK
- `sessionId` UUID FK to `telemetry_sessions.id` (required)
- `runId` UUID FK to `telemetry_processing_runs.id` (required)
- `datasetType` enum
  `CANON_GNSS | CANON_ACCEL | CANON_GYRO | CANON_MAG | FUSED_POSE | LAP_EVENTS | DOWNSAMPLE_GNSS | DOWNSAMPLE_ACCEL | DOWNSAMPLE_GYRO | DOWNSAMPLE_MAG | DOWNSAMPLE_POSE`
  (required)
- `sensorType` enum `GNSS | IMU | FUSION`
- `imuDof` integer (optional), expected values `3 | 6 | 9` when
  `sensorType = IMU`
- `imuChannels` text[] (optional), values from `{ACCEL, GYRO, MAG}` when
  `sensorType = IMU`
- `frame` text (optional), values from `{DEVICE, VEHICLE}` when
  `sensorType = IMU`
- `axisConvention` text (optional), when `sensorType = IMU` (required)
- `sampleRateHz` integer (optional), for canonical streams use detected nominal
- `downsampleFactor` integer (optional)
- `clickhouseTable` text (required)
- `clickhouseWhereHint` text (optional), for example
  `session_id = '...' AND ts BETWEEN ...`
- `schemaVersion` integer (required)
- `unitsVersion` integer (required)
- `createdFromArtifactIds` uuid[] (required)

Indexes:

- `(sessionId, datasetType)`
- `(runId)`

### 7.6 Laps, segments, and manual edits

Telemetry lap structure is derived from start/finish crossings.

#### 7.6.1 TelemetryLap

**Table:** `telemetry_laps`

Columns:

- `id` UUID PK
- `sessionId` UUID FK (required)
- `runId` UUID FK (required)
- `lapNumber` integer (required, 1-based)
- `startTimeUtc` timestamptz (required)
- `endTimeUtc` timestamptz (required)
- `durationMs` integer (required)
- `validity` enum `VALID | INVALID | OUTLAP | INLAP` (default `VALID`)
- `qualityScore` float (optional)

Constraints:

- Unique `(runId, lapNumber)`

Indexes:

- `(sessionId, lapNumber)`
- `(runId, lapNumber)`

#### 7.6.2 TelemetrySegment

**Table:** `telemetry_segments`

Columns:

- `id` UUID PK
- `sessionId` UUID FK (required)
- `name` text (required)
- `orderIndex` integer (required)
- `definition` jsonb (required), for example a polyline, bounding boxes, or gate
  lines
- `createdByUserId` UUID FK (optional)
- `createdFromRunId` UUID FK (optional)

Indexes:

- Unique `(sessionId, orderIndex)`

#### 7.6.3 TelemetryEdit

**Table:** `telemetry_edits`

Purpose: record user edits that influence subsequent processing.

Columns:

- `id` UUID PK
- `sessionId` UUID FK (required)
- `editType` enum
  `ASSIGN_TRACK | SET_START_FINISH | ADJUST_LAP | DEFINE_SEGMENT | DELETE_SEGMENT`
  (required)
- `payload` jsonb (required)
- `createdByUserId` UUID FK (required)

Indexes:

- `(sessionId, createdAt DESC)`

### 7.7 Team and share grants

#### 7.7.1 Team

**Table:** `teams`

Columns:

- `id` UUID PK
- `name` text (required)
- `ownerUserId` UUID FK to `users.id` (required)

Constraints:

- Unique `(name)` initially, can be relaxed to `(ownerUserId, name)` later.

#### 7.7.2 TeamMember

**Table:** `team_members`

Columns:

- `teamId` UUID FK (required)
- `userId` UUID FK (required)
- `role` enum `MANAGER | MEMBER` (required)

Constraints:

- PK `(teamId, userId)`

#### 7.7.3 TelemetryShareGrant

**Table:** `telemetry_share_grants`

Purpose: explicit grants for team sharing.

Columns:

- `id` UUID PK
- `sessionId` UUID FK (required)
- `teamId` UUID FK (optional)
- `granteeUserId` UUID FK (optional), for direct share
- `permission` enum `VIEW | ADMIN` (default `VIEW`)

Rules:

- For team share, set `teamId`.
- For direct share, set `granteeUserId`.

#### 7.7.4 TelemetryPublicShare

**Table:** `telemetry_public_shares`

Columns:

- `id` UUID PK
- `sessionId` UUID FK (required)
- `token` text unique (required)
- `createdByUserId` UUID FK (required)
- `expiresAt` timestamptz (optional)
- `isRevoked` boolean (default false)

## 8. ClickHouse schema, telemetry time-series

### 8.1 General design

Patterns:

- Use MergeTree-family engines.
  ([clickhouse.com](https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree))
- Partition by a coarse time expression, monthly is a typical default.
  ([clickhouse.com](https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree))
- Order by keys that match dominant filters, and keep timestamp in the ordering
  key to support range scans.
  ([clickhouse.com](https://clickhouse.com/docs/best-practices/choosing-a-primary-key))

Dominant query patterns for MRE telemetry:

- Per session: fetch time window for chart, lap overlay, segment analysis.
- Cross lap within session: group by lapNumber, compute aggregates.

Therefore ordering keys are designed around `session_id` and `ts`.

### 8.2 Table naming and schema versioning

Naming convention:

- `telemetry_<stream>_v<schemaVersion>`

Do not mutate historical schemas.

- Add new tables on schema change.
- Update Postgres `telemetry_datasets.schemaVersion`.

### 8.3 Canonical GNSS points

**Table:** `telemetry_gnss_v1`

Columns:

- `session_id` UUID stored as String
- `run_id` UUID stored as String
- `artifact_id` UUID stored as String
- `ts` DateTime64(3, 'UTC')
- `lat_deg` Float64
- `lon_deg` Float64
- `alt_m` Float32
- `speed_mps` Float32
- `course_deg` Float32
- `hacc_m` Float32 (optional)
- `vacc_m` Float32 (optional)
- `sat_count` UInt8 (optional)
- `fix_type` UInt8 (optional)
- `quality_flags` UInt32 (bitset)

Engine:

- MergeTree
- PARTITION BY toYYYYMM(ts)
- ORDER BY (session_id, ts)

### 8.4 IMU DOF and channel modelling

IMU inputs vary by device and export format:

- **3-axis**: typically accel only (ACCEL) or gyro only (GYRO), three channels.
- **6-axis**: accel plus gyro (ACCEL plus GYRO), six channels.
- **9-axis**: accel plus gyro plus magnetometer (ACCEL plus GYRO plus MAG), nine
  channels.

To keep ClickHouse queries fast and avoid wide sparse rows, IMU data is stored
as **channel-specific streams**:

- Acceleration samples in an accel table.
- Gyroscope samples in a gyro table.
- Magnetometer samples in a mag table.

A single telemetry session can therefore have:

- Only accel datasets (3-axis accel).
- Accel plus gyro datasets (6-axis).
- Accel plus gyro plus mag datasets (9-axis).

This is expressed in Postgres using `telemetry_datasets` rows:

- For IMU devices, create one dataset row per channel stream present.
- Populate `imuDof` and `imuChannels` for each dataset row so the UI and fusion
  pipeline can discover what exists.

### 8.5 Canonical acceleration samples

**Table:** `telemetry_accel_v1`

Columns:

- `session_id` String
- `run_id` String
- `artifact_id` String
- `ts` DateTime64(3, 'UTC')
- `ax_mps2` Float32
- `ay_mps2` Float32
- `az_mps2` Float32
- `temp_c` Float32 (optional)
- `quality_flags` UInt32

Engine:

- MergeTree
- PARTITION BY toYYYYMM(ts)
- ORDER BY (session_id, ts)

### 8.6 Canonical gyroscope samples

**Table:** `telemetry_gyro_v1`

Columns:

- `session_id` String
- `run_id` String
- `artifact_id` String
- `ts` DateTime64(3, 'UTC')
- `gx_rps` Float32
- `gy_rps` Float32
- `gz_rps` Float32
- `temp_c` Float32 (optional)
- `quality_flags` UInt32

Engine:

- MergeTree
- PARTITION BY toYYYYMM(ts)
- ORDER BY (session_id, ts)

### 8.7 Canonical magnetometer samples (9-axis only)

**Table:** `telemetry_mag_v1`

Columns:

- `session_id` String
- `run_id` String
- `artifact_id` String
- `ts` DateTime64(3, 'UTC')
- `mx_uT` Float32
- `my_uT` Float32
- `mz_uT` Float32
- `cal_state` UInt8 (optional), for example 0 unknown, 1 uncalibrated, 2
  calibrated
- `quality_flags` UInt32

Engine:

- MergeTree
- PARTITION BY toYYYYMM(ts)
- ORDER BY (session_id, ts)

### 8.8 Fused pose stream

**Table:** `telemetry_pose_v1`

Columns:

- `session_id` String
- `run_id` String
- `ts` DateTime64(3, 'UTC')
- `x_m` Float32 (track-local or ENU)
- `y_m` Float32
- `z_m` Float32 (optional)
- `vx_mps` Float32
- `vy_mps` Float32
- `yaw_rad` Float32
- `yaw_rate_rps` Float32
- `quality_score` Float32
- `quality_flags` UInt32

Engine:

- MergeTree
- PARTITION BY toYYYYMM(ts)
- ORDER BY (session_id, ts)

### 8.9 Downsampled tables

Downsampled tables exist to accelerate UI.

Examples:

- `telemetry_gnss_ds10_v1`, 10x downsample
- `telemetry_accel_ds10_v1`, 10x downsample
- `telemetry_gyro_ds10_v1`, 10x downsample
- `telemetry_mag_ds10_v1`, 10x downsample (only when mag present)
- `telemetry_pose_ds10_v1`

Rule:

- Downsample outputs are materialised by the worker, not computed on the fly.

## 9. Contracts

Contracts are the agreed behaviours between UI, API, and workers.

### 9.1 Ingest contract

#### 9.1.1 Upload

Input:

- `session_id` optional. If absent, API creates a session in `UPLOADING`.
- file bytes plus metadata (name, contentType).

API responsibilities:

- Authenticate owner.
- Create `telemetry_artifacts` row with checksum and `UPLOADED`.
- Enqueue canonicalisation job.

Idempotency:

- If an identical artifact is uploaded to the same session (same sha256 and
  byteSize), API returns the existing artifact id.

#### 9.1.2 Canonicalisation

Worker responsibilities:

- Detect format.
- Convert to canonical units and fields.
- Determine IMU DOF and channel presence (ACCEL, GYRO, MAG).
- Write canonical samples into ClickHouse tables:
  - GNSS to `telemetry_gnss_v*`
  - ACCEL to `telemetry_accel_v*`
  - GYRO to `telemetry_gyro_v*`
  - MAG to `telemetry_mag_v*` when present
  - Fused outputs to `telemetry_pose_v*` when produced

- Mark artifact status `CANONICALISED` and set `discardedAt` once raw bytes
  deleted.

Discard rule:

- Raw bytes must be deleted after canonicalisation succeeds, and `discardedAt`
  must be set.

### 9.2 Processing contract

Trigger:

- Automatic after all required artifacts present, or user initiated reprocess.

Worker responsibilities:

- Create `telemetry_processing_runs` record.
- Produce `telemetry_datasets` rows.
- Produce `telemetry_laps` using start/finish crossings.
- Mark `telemetry_sessions.currentRunId` on success.

Immutability:

- A completed run is never modified.
- A new run is created for reprocessing.

### 9.3 Query contract

#### 9.3.1 Authorisation

API must authorise using Postgres before querying ClickHouse.

Rules:

- Owner can always view.
- Team share requires membership.
- Public share requires a valid, non-revoked token.

#### 9.3.2 Windowed time-series retrieval

Input:

- sessionId
- runId optional, default to session currentRunId
- datasetType
- time window [start, end]
- resolution hint, for example target points 2,000

Behaviour:

- API selects an appropriate dataset, canonical or downsampled, based on
  resolution hint.
- API queries ClickHouse by `session_id` and `ts` range.

### 9.4 Mutation contract, edits

Edits create rows in `telemetry_edits`.

Reprocessing behaviour:

- Reprocess uses all edits for the session to influence lap detection and
  segmentation.
- Reprocess creates a new immutable run.

### 9.5 Deletion contract

Default deletion is tombstone plus lifecycle cleanup.

Behaviour:

- Mark session status `DELETED` and set `deletedAt`.
- Enqueue background purge job that deletes ClickHouse rows for that session and
  deletes remaining artifact objects.

## 10. Device and multi-device model

You flagged uncertainty on the multiple device question.

Interpretation for MRE:

- A session can contain artifacts from one or more devices.
- If multiple devices exist, one is designated `primaryDeviceId` for default
  charts.
- Fusion can optionally incorporate multiple sources, but v1 can pick the best
  GNSS and best IMU stream.

Policy defaults:

- If only one device, it is primary.
- If multiple devices and one is explicitly marked, use that.
- Otherwise choose the device that yields highest overall quality score.

## 11. Open questions (non-blocking, safe defaults)

- Sample rates: store detected `sampleRateHz` per dataset, design ClickHouse
  tables to accept variable rates.
- Coordinate frame conversions: store declared frame metadata in
  `telemetry_devices.capabilities` and in dataset metadata.
- Public share scope: decide if public shares expose full-resolution data or
  only downsampled.
