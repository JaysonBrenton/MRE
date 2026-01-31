# MRE Architecture Blueprint: Telemetry Ingest, Storage, Compute, Query

## Audience

This document describes where each part of MRE should run, which services own
which responsibilities, and how data should flow through the system.

---

# Glossary (Plain English)

| Term             | Plain English meaning                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| API              | The server endpoints the UI calls to create sessions, upload files, and fetch results.                              |
| Artifact         | A stored file blob, either the raw upload or a processed output.                                                    |
| Canonical stream | A standard internal format for time series data so the rest of the app does not care about original file types.     |
| Columnar format  | A storage format optimised for analytics by storing data by column rather than by row. Parquet is a common example. |
| Compute plane    | The worker processes that run heavy calculations, separate from the web server.                                     |
| Control plane    | The web app and APIs that manage users, sessions, jobs, permissions, and metadata.                                  |
| Downsampling     | Reducing the number of points in a time series while keeping the overall shape, so charts load fast.                |
| DuckDB           | An analytics engine that can query Parquet files quickly, often used inside Python jobs.                            |
| Job              | A unit of work for the worker to run, like parse, normalise, fuse, or compute metrics.                              |
| Object storage   | File storage like S3, good for large immutable files.                                                               |
| Parquet          | A compressed columnar file format that is efficient for large time series and analytics.                            |
| Postgres         | A relational database used as the system of record for metadata, jobs, and summaries.                               |
| Provenance       | A record of how an output was produced, including input hashes and algorithm versions.                              |
| Queue            | A mechanism to store jobs so workers can pick them up and process them.                                             |
| Time series      | Data points over time, like speed, position, g force, or gyro rate.                                                 |
| TimescaleDB      | A Postgres extension designed for time series storage and querying.                                                 |
| ClickHouse       | A database designed for fast analytics over large datasets and telemetry.                                           |
| Worker           | A process that runs compute heavy tasks outside the web server.                                                     |

---

# System Overview

## Core components

1. Web UI (Next.js)

- Uploads, session management, dashboards, visualisations

2. API layer (Next.js route handlers or a dedicated API service)

- Auth, session CRUD, dataset metadata, job orchestration, result retrieval

3. Telemetry worker (Python)

- File type detection and parsing
- Decompression and conversion (RINEX, CRINEX, BINEX, UBX, NMEA, CSV)
- Normalisation of units, timestamps, coordinate frames
- Fusion (3 axis, 6 axis, 9 axis modes)
- Feature extraction (laps, sectors, corners, braking, jumps)
- Output generation (time series, metrics, events)

4. Storage

- Raw artifact store for original uploads
- Processed artifact store for large time series outputs

5. Databases

- Postgres as the system of record for metadata, sessions, users, jobs,
  summaries
- Optional second database or file store for high volume time series and
  analytics

---

# Data Flow

## High level flow

1. User uploads files via UI
2. API accepts upload; worker canonicalises; raw bytes are discarded after
   successful canonicalisation (see
   ADR-20260131-telemetry-storage-and-raw-retention)
3. API creates an Import Session and one or more Processing Jobs
4. Python worker picks up job, parses and normalises
5. Worker writes canonical streams and derived outputs
6. API serves summaries quickly from Postgres and streams time series from
   artifact storage

## Why this split

- Postgres stays responsive and small for UI queries
- Python can scale independently for compute
- Large time series are stored efficiently and can be reprocessed without re
  upload

---

# Storage Strategy

## Two tier storage model

### Tier 1: Raw artifact store

Do not store raw upload bytes after canonicalisation. Discard them immediately;
keep only metadata (hash, size, type, parse version). See
`docs/adr/ADR-20260131-telemetry-storage-and-raw-retention.md`.

### Tier 2: Processed artifact store and time series queries

Time series queries are served from **ClickHouse** (authoritative). Parquet is
used for worker output and exports only.

- Store canonical streams and derived outputs as columnar files (Parquet for
  worker output and export)
- Partition by session_id and stream type

Example processed outputs:

- gnss_pvt.parquet
- imu.parquet
- fused_traj.parquet
- lap_events.parquet
- corner_events.parquet
- metrics_per_lap.parquet

---

# Database Strategy

## Postgres remains required

Postgres should store:

- Users, auth identities
- Sessions (race sessions, import sessions)
- Dataset metadata (what files were uploaded)
- Job queue state (pending, running, succeeded, failed)
- Summaries used by the UI (per lap metrics, per segment metrics)
- Provenance records (which algorithm version produced which outputs)

Postgres tables should not store high rate raw time series at scale unless you
have a strong reason.

## When to add a second database

Add another database when you hit one or more of these:

- You want sub second queries over millions to billions of telemetry points
- You want heavy analytics across many sessions without precomputing summaries
- You want easy downsampling and aggregation across large windows

## Recommended second store options

Pick one of these patterns.

### Option A: Postgres plus Parquet in object storage

This is usually the best starting point.

- Postgres stores metadata and summary tables
- Time series live in Parquet files
- UI fetches only what it needs by time range and downsample level

Pros:

- Simple, cheap, reliable
- Great compression
- Easy replay and offline processing

Cons:

- Cross session analytics require either batch jobs or loading Parquet for
  analysis

### Option B: Postgres plus ClickHouse for analytics

ClickHouse is excellent for telemetry analytics.

- Store high volume time series in ClickHouse
- Keep metadata and jobs in Postgres

Pros:

- Very fast aggregations and filtering
- Good for dashboards and comparisons across many sessions

Cons:

- Another database to operate
- Data modelling choices matter

### Option C: Postgres plus TimescaleDB extension

TimescaleDB can work well if you want time series inside Postgres.

Pros:

- Stays within the Postgres ecosystem
- Hypertables, compression, continuous aggregates

Cons:

- Still heavier on Postgres storage
- Might become costly if you store very high rate IMU at scale

### Option D: Postgres plus DuckDB for local analytics

DuckDB is great for analysis over Parquet, especially in a worker.

Pros:

- Amazing for batch analytics and feature extraction
- No separate server required, works well in Python

Cons:

- Not a multi user online analytics database

## A pragmatic recommendation

- Start with Option A, Postgres plus Parquet
- Use DuckDB inside the Python worker for heavy analysis over Parquet
- Add ClickHouse later if you need interactive cross session analytics at scale

---

# Service Boundaries and Responsibilities

## Next.js UI

- Upload UI
- Session selection
- Visualisations (maps, charts, comparisons)
- Status and progress

## Next.js API

- Authentication
- Create import session
- Persist raw artifact
- Create jobs and track state
- Serve summaries fast
- Provide signed URLs or streaming for time series chunks

## Python worker

- Parse and normalise
- Detect GNSS formats and decompress
- Convert CRINEX to RINEX
- Decode BINEX or convert to RINEX then parse
- Decode UBX and NMEA
- Build canonical streams
- Infer IMU axis capabilities
- Run fusion based on capabilities
- Derive lap and segment events
- Produce metrics and confidence

---

# Job Orchestration

## Job model

Every import creates one or more jobs.

Example jobs:

- parse_raw_artifacts
- normalise_streams
- fuse_trajectory
- extract_events
- compute_metrics
- build_downsample_pyramids

## Queue options

- Simple: Postgres backed queue table with SKIP LOCKED in Next.js or Python
- More advanced: Redis plus a worker framework

Recommendation:

- Start with Postgres queue tables because you already run Postgres
- Upgrade only when you need horizontal scaling

---

# Time Series Access Pattern for the UI

## Problem

The UI should never load 200,000 IMU points when it needs a chart on screen.

## Solution

Create downsampled representations.

### Downsample pyramid

For each stream, precompute levels:

- level 0: raw
- level 1: 10x downsample
- level 2: 100x downsample
- level 3: 1000x downsample

Store as separate Parquet files or separate partitions.

UI chooses level based on requested time range and pixel width.

---

# Schema Sketch (Postgres)

## Tables

- users
- sessions
- uploads
- artifacts
- jobs
- algorithm_versions
- derived_datasets
- lap_summaries
- segment_summaries
- event_markers

## Key columns to include

- session_id
- artifact_id
- dataset_type
- start_time, end_time
- sample_rate_hz
- imu_capabilities (accel, gyro, mag)
- gnss_capabilities (pvt, raw_obs)
- processing_version identifiers
- quality_score and flags

---

# Security and Provenance

## Provenance requirements

Every derived output should record:

- source artifact hashes
- parser versions
- fusion algorithm version
- configuration parameters

This makes results reproducible.

## Upload safety

- Validate file sizes
- Virus scan if required
- Never execute unknown binaries

---

# Performance Budgets and Scaling

## Compute

- Python worker should be able to process a 10 minute session at high IMU rates
  with headroom.
- Use vectorised operations and chunked processing.

## API

- API endpoints should return summaries quickly from Postgres.
- Time series endpoints should stream from Parquet or a time series store.

## Horizontal scaling

- Add more Python worker processes first.
- Add a second database only when query patterns demand it.

---

# Phased Delivery Order

This section is about delivery order, not capability exclusion.

1. Postgres metadata plus raw artifact storage
2. Python parsing and normalisation, produce canonical streams
3. Downsample pyramid generation
4. Fusion and event extraction
5. Metrics and comparisons
6. Optional: ClickHouse for interactive cross session analytics

---

# Concrete Recommendation for MRE

- Keep Postgres as the control plane database.
- Store large time series as Parquet in an artifact store.
- Use Python for compute and DuckDB for analytics over Parquet.
- Add ClickHouse later if you want fast interactive analytics across many
  sessions.

---

# Appendix: What goes where

## Postgres

- Session metadata
- Job state
- Summary metrics
- Event markers

## Parquet artifacts

- Raw or normalised time series
- Fused trajectories
- Downsample levels

## Python worker

- All parsing, normalisation, fusion, metrics

## Next.js

- Orchestration and visualisation
