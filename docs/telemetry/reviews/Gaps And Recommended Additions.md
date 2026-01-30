# MRE Telemetry Docs Review

## Reviewed documents (from `telemetry.zip`)

### Blueprints

- `Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md`
- `Telemetry_Ux_Blueprint.md`
- `Gnss_plus_Imu_Fusion_Blueprint.md`

### User story

- `User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md`

### End user experience

- `Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md`

## What is already covered well

- Clear end to end intent: ingest, normalise, downsample, fuse, analyse, with
  phased delivery.
- Solid UX information architecture: Session Overview, Lap Compare, Segments and
  Corners, trust behaviours.
- Strong GNSS plus IMU canonicalisation and fusion blueprint: capability
  detection, time alignment, EKF notes.
- Sensible separation: Postgres for metadata, and Parquet or analytics store for
  large time series.

## Gaps worth addressing (high impact)

### 1) Concrete data model and contracts

You have a schema sketch, but not a complete, implementation-ready model.

Missing items to define:

- Entity relationships, required columns, indexes, partitioning strategy.
- Tenancy boundaries, for example user, team, org.
- Algorithm versioning fields and roll-forward rules.
- Mapping from artifacts to derived datasets and downsample levels.

Add:

- `telemetry/Data_Model_and_Schema.md`
- `telemetry/Prisma_Model_Guidance.md`

### 2) API contract and query patterns

UX assumes fast summaries and interactive charts, but there is no clear API
spec.

Missing items to define:

- Endpoints, request and response shapes, pagination, filtering.
- Time series window semantics, level selection, downsample rules.
- Caching, ETags, or signed URLs if Parquet and object storage is used.

Add:

- `telemetry/API_Contract_Telemetry.md`

### 3) Job orchestration and state machine

You reference workers and failures, but not a single authoritative pipeline
spec.

Missing items to define:

- Job states, retries, idempotency rules.
- Correlation of uploads, sessions, processing runs.
- Concurrency limits, cancellation, partial success.
- Queue location and behaviour, for example DB queue, Redis, SQS.

Add:

- `telemetry/Processing_Pipeline_and_Job_State_Machine.md`

### 4) Trust, quality scoring, and honesty rules

You mention trust behaviours and quality flags, but the scoring model is not
defined.

Missing items to define:

- Quality inputs, for example GNSS HDOP, speed plausibility, IMU saturation,
  timestamp jitter.
- When to warn, when to hide features, when to degrade.
- Audit and provenance, reproducibility guarantees.

Add:

- `telemetry/Data_Quality_and_Provenance.md`

### 5) Security, privacy, retention, deletion

You have open questions, but not an end to end policy and implementation
guidance.

Missing items to define:

- Retention defaults, lifecycle for raw uploads and derived datasets.
- User initiated delete semantics, hard delete vs tombstone.
- Encryption at rest, access control, signed download URLs.
- Handling of sensitive data, for example location traces.

Add:

- `telemetry/Security_Privacy_Retention.md`

## Gaps worth addressing (implementation acceleration)

### 6) Supported formats and parser spec

You describe detection rules conceptually, but a compatibility matrix will speed
delivery.

Add:

- `telemetry/Supported_Formats_and_Parsing_Spec.md`

Include:

- Supported devices and file types.
- Expected columns and units.
- Coordinate frames.
- Normalisation rules per format.
- Known quirks and edge cases.

### 7) Lap, segment, corner detection spec

You have Segments and Corners in UX, but no canonical algorithm and editing
loop.

Add:

- `telemetry/Lap_and_Segment_Logic.md`

Include:

- Lap boundary detection and start finish inference.
- Pit handling.
- Segment model, auto segmentation and manual edit, persistence.
- Corner classification, speed zones, jump detection rules.

### 8) Performance plan and benchmarking

You note budgets, but not measurable targets tied to dataset sizes.

Add:

- `telemetry/Performance_Benchmarks.md`

Include:

- Target session lengths and sample rates.
- Expected processing time per stage.
- Query latency targets for common screens.
- Downsample pyramid generation cost and storage impact.

### 9) Test strategy and synthetic datasets

You will want repeatable datasets to validate parsers, fusion, and UI behaviour.

Add:

- `telemetry/Test_Strategy_and_Synthetic_Data.md`

Include:

- Golden files for parsers.
- Synthetic sessions for regression, including edge cases.
- Validation harness for fusion output sanity.

### 10) Operational runbook

Once this runs in production, you will want a minimal runbook.

Add:

- `telemetry/Operations_Runbook.md`

Include:

- Worker deployment and scaling.
- Queue depth and processing SLA monitoring.
- Failure modes and operator actions.
- Backfill and reprocess procedures.

## Recommended document additions (suggested order)

If the goal is to move from docs to working code quickly, add these first:

1. `telemetry/Processing_Pipeline_and_Job_State_Machine.md`
2. `telemetry/API_Contract_Telemetry.md`
3. `telemetry/Data_Model_and_Schema.md`
4. `telemetry/Data_Quality_and_Provenance.md`
5. `telemetry/Supported_Formats_and_Parsing_Spec.md`

## ADRs to consider adding

Capture these as ADRs under `docs/adr/` because they lock in major choices:

- ADR: Telemetry storage approach, for example Postgres metadata plus object
  storage Parquet, and when to introduce ClickHouse or Timescale.
- ADR: Job queue mechanism, for example DB backed queue vs Redis vs SQS, and
  retry semantics.
- ADR: Versioning and reproducibility, including algorithm versions, parser
  versions, immutable artifacts.
- ADR: Data retention and deletion policy, including user tiering later.
