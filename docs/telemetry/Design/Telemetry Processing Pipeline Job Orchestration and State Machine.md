# Telemetry Processing Pipeline, Job Orchestration, and State Machine

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define the authoritative telemetry processing pipeline, job
orchestration model, and state machine semantics for MRE telemetry ingest,
normalisation, downsampling, fusion, and analytics readiness.  
License: Proprietary, internal to MRE

## 1. Scope

This document defines:

- The end to end processing pipeline from upload to query-ready datasets
- The job model (job types, correlation identifiers, retries, idempotency)
- The state machine (states, transitions, cancellation, partial success)
- Concurrency and orchestration behaviour (queues, locks, worker pools)
- Operational and observability expectations (metrics, logs, traceability)

Out of scope (covered in other documents):

- Detailed schema for telemetry time series storage and query APIs
- Data quality scoring rules (inputs and thresholds)
- Parser format compatibility matrix
- Lap, segment, and corner algorithms in depth

## 2. Design goals

- Single authoritative pipeline spec, easy to reason about and operate
- Deterministic, reproducible processing runs via explicit versioning
- Idempotent processing so retries and replays are safe
- Partial success supported, UI can show usable outputs even if later stages
  fail
- Simple first implementation, with a clean path to scale later

## 3. Terminology

- **Artifact**: The raw uploaded file (or set of files) as received from a
  device or export.
- **Processing Run**: One execution of the pipeline for a given artifact set,
  with fixed versions of parsers and algorithms.
- **Job**: A unit of work for a specific stage of a processing run.
- **Attempt**: One execution try of a job (for retries and diagnostics).
- **Derived Dataset**: Output produced by a job, for example normalised series,
  downsample levels, fused series, lap table.
- **Session**: The user-visible telemetry session entity that links to artifacts
  and derived datasets.

## 4. High level pipeline

A processing run is a directed acyclic graph (DAG) of jobs. The first version is
implemented as a staged pipeline with clear dependencies.

### 4.1 Default stages and job types

Stage 0: Intake

- `artifact_validate`: validate file, size, checksum, basic MIME/extension
  checks
- `artifact_classify`: detect device format, schema variant, coordinate frame
  hints

Stage 1: Parse and canonicalise

- `parse_raw`: parse device format to a canonical stream set (GNSS, IMU, others)
- `normalise_units`: convert units and coordinate frames into MRE canonical form
- `time_align`: enforce monotonic timestamps, align streams, record drift and
  jitter stats

Stage 2: Downsample pyramid

- `downsample_L0`: raw canonical series stored, minimal cleaning applied
- `downsample_L1`: medium resolution for interactive charts
- `downsample_L2`: low resolution for long sessions and overview charts  
  Notes: Level names can be `L0`, `L1`, `L2`, or explicit sample rates, but must
  be consistent.

Stage 3: Fusion (optional based on capability and config)

- `fuse_gnss_imu`: run fusion pipeline, produce fused pose and derived
  kinematics
- `fuse_quality_summary`: compute fusion health stats, flags, and confidence
  fields

Stage 4: Racing semantics

- `detect_laps`: start/finish detection, lap boundaries, pit handling
- `detect_segments`: segment inference, corner candidates, jump candidates
- `compute_metrics`: per-lap and per-segment metrics, deltas, aggregates
- `build_indexes`: precompute query helpers, for example lap to time ranges,
  segment to time ranges

Stage 5: Materialise (ClickHouse cache)

- `materialise_clickhouse`: write derived tables to ClickHouse from canonical
  Parquet for interactive reads. Inputs: canonical Parquet location,
  `session_id`, `processing_run_id`, `schema_version`. Output: derived tables
  and materialisation record. See
  `docs/adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md`.

Stage 6: Publish

- `publish_session`: mark session query-ready and emit domain events for UI
  refresh

### 4.2 Capability gating

The pipeline must support dynamic gating:

- If no IMU stream is present, skip `fuse_gnss_imu`
- If GNSS quality is insufficient, fusion may be skipped or run in degraded mode
- If lap detection fails, publish partial outputs and mark lap-based screens as
  unavailable

Gating logic is explicit per job dependency rules and recorded in the run
metadata.

## 5. Orchestration model

### 5.1 Recommended first implementation

Use a Postgres-backed queue for v1:

- Lowest operational overhead
- Strong consistency for state transitions
- Easy correlation to metadata tables and UI

A later evolution can move the queue to Redis or SQS with minimal changes if the
job model is stable.

### 5.2 Worker model

- One or more worker processes (Python recommended if parsers and fusion live
  there today)
- Workers poll the DB queue, claim jobs, execute, write outputs, update job
  state
- Workers are stateless and horizontally scalable
- Outputs are written to object storage (or filesystem in dev), with pointers
  stored in Postgres

### 5.3 Job claiming and locks

To avoid duplicate processing:

- Use `SELECT ... FOR UPDATE SKIP LOCKED` to claim runnable jobs
- Claim includes setting `locked_at`, `locked_by`, and moving
  `queued -> running`
- If a worker dies, jobs with stale locks can be re-queued by a reaper

Recommended stale lock threshold: 10 to 30 minutes, configurable per job type.

## 6. Core entities and relationships

This section describes the minimum metadata entities required for orchestration.
Exact columns are illustrative.

**MVP implementation:** For MVP, the **authoritative** job schema is the single table `telemetry_jobs` defined in [Concrete Data Model §7.4](Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md) and [Telemetry MVP Implementation Decisions §1](Telemetry_MVP_Implementation_Decisions.md). No separate `telemetry_job_attempt` table in MVP; retry and error fields are on the job row. The schema below (§6.3–6.5) is a fuller conceptual model; implement MVP per the Concrete Data Model and MVP Decisions.

### 6.1 `telemetry_artifact`

Represents raw uploads.

- `id` (uuid)
- `owner_user_id`
- `session_id` (nullable until session is created)
- `filename`, `content_type`, `bytes`
- `sha256`
- `storage_url` (raw object location)
- `ingested_at`
- `status` (uploaded, validated, rejected, deleted)
- `format_detected` (nullable until classified)
- `metadata_json` (optional, device specific)

### 6.2 `telemetry_processing_run`

Represents one processing execution with pinned versions.

- `id` (uuid)
- `session_id`
- `artifact_set_hash` (hash of ordered artifact ids and sha256 values)
- `requested_by` (user or system)
- `parser_version`
- `pipeline_version`
- `fusion_version` (nullable if not used)
- `status` (see state machine, run-level)
- `started_at`, `completed_at`
- `failure_reason` (nullable)
- `config_json` (runtime knobs, for example skip_fusion)

### 6.3 `telemetry_job`

Represents a unit of work. **MVP:** Use the single-table schema in [Concrete Data Model §7.4](Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md) (id, runId, jobType, status, payload, attemptCount, maxAttempts, lockedAt, lockedBy, lastErrorCode, lastErrorMessage, nextRetryAt, createdAt, updatedAt). No separate attempt table; no depends_on in MVP.

Conceptual (v1+ optional):

- `id` (uuid)
- `run_id`
- `job_type` (enum)
- `depends_on` (list of job ids or derived datasets, modelled via join table) — MVP: not implemented
- `state` (see state machine)
- `priority` (default 0)
- `attempt_count`
- `max_attempts`
- `next_run_at` (for backoff)
- `locked_at`, `locked_by`
- `last_error_code`, `last_error_message`
- `created_at`, `updated_at`

### 6.4 `telemetry_job_attempt`

Diagnostics and traceability.

- `id` (uuid)
- `job_id`
- `attempt_number`
- `started_at`, `ended_at`
- `worker_id`
- `logs_url` (optional)
- `metrics_json` (duration, bytes read, rows written)
- `error_code`, `error_message` (nullable)
- `status` (succeeded, failed, timed_out, cancelled)

### 6.5 `telemetry_derived_dataset`

Pointers to outputs.

- `id` (uuid)
- `run_id`
- `dataset_type` (canonical_raw, downsample_L1, fused_pose, laps_table,
  metrics_table, indexes)
- `storage_url`
- `content_hash` (for dedupe and integrity)
- `schema_version`
- `created_by_job_id`
- `time_range_start`, `time_range_end` (optional)
- `stats_json` (row counts, sampling rates, quality flags)

## 7. State machines

There are two related state machines:

- Job-level state machine
- Run-level state machine

### 7.1 Job state machine

#### States

- `created`: job exists but not yet eligible to run (dependencies unresolved)
- `queued`: eligible to run and awaiting a worker
- `running`: claimed by a worker and executing
- `succeeded`: completed successfully, outputs recorded
- `failed`: exhausted retries or non-retriable failure
- `retry_wait`: failed but will retry after backoff
- `cancel_requested`: cancellation requested, worker should stop if safe
- `cancelled`: cancelled before completion
- `skipped`: intentionally skipped due to gating rules

#### Allowed transitions

- `created -> queued` when all dependencies are satisfied
- `queued -> running` when claimed by a worker
- `running -> succeeded` on success
- `running -> retry_wait` on retriable failure with attempts remaining
- `retry_wait -> queued` when `next_run_at <= now()`
- `running -> failed` on non-retriable failure or attempts exhausted
- `queued -> cancelled` if cancelled before start
- `running -> cancel_requested` when user/system requests cancellation
- `cancel_requested -> cancelled` when worker acknowledges and stops safely
- `created -> skipped` if gating logic indicates this job is not applicable
- `queued -> skipped` if gating changes before execution (rare but possible)

#### Retriable vs non-retriable failures

Retriable examples:

- transient storage read failure
- temporary network failure
- worker restart or crash mid-job (if idempotent)

Non-retriable examples:

- file format unsupported
- corrupt file, checksum mismatch
- schema mismatch that parser cannot recover from

Store `last_error_code` as a stable enum and `last_error_message` for operator
detail.

### 7.2 Run state machine

#### States

- `pending`: run created, jobs being planned
- `running`: at least one job has started, run not complete
- `partial`: some outputs are usable, but one or more non-critical jobs failed
- `failed`: a critical job failed, run cannot be published
- `succeeded`: all required jobs succeeded, session published
- `cancelled`: run cancelled

#### Criticality rules

Define a minimal required set per run:

- Required jobs: `artifact_validate`, `artifact_classify`, `parse_raw`,
  `normalise_units`, `time_align`, `downsample_L1`, `materialise_clickhouse`,
  `publish_session`
- Optional jobs: `fuse_gnss_imu`, `detect_laps`, `detect_segments`,
  `compute_metrics`, `build_indexes`

A run becomes:

- `failed` if any required job enters `failed`
- `partial` if required jobs succeeded, but one or more optional jobs failed or
  were skipped
- `succeeded` if all required and optional jobs succeed, or optional jobs are
  legitimately skipped by gating rules

This behaviour must be recorded in run metadata so the UI can explain why
certain features are unavailable.

## 8. Idempotency and determinism

### 8.1 Idempotency key strategy

Each job type must have an idempotency key computed from:

- `run_id`
- `job_type`
- `input_dataset_hashes` (or artifact hashes for early stages)
- `job_config_hash` (derived from `run.config_json` and job params)
- `version_tuple` (parser_version, pipeline_version, fusion_version)

If the same job is retried, it should:

- Reuse the same derived dataset record if already created and verified
- Or create a new dataset and mark the old one superseded, but only if safe and
  explicit

Preferred: write outputs to a temporary location, then atomically promote on
success.

### 8.2 Output immutability

Derived datasets are immutable once published:

- Create new datasets on reprocess
- Never modify existing objects in place
- Keep pointers from the run to the datasets it produced

This enables reproducibility and audit.

## 9. Retry, backoff, and timeouts

### 9.1 Retry policy

Default:

- `max_attempts = 3` for most jobs
- Backoff schedule: 30s, 2m, 10m (configurable)
- Store `next_run_at` for `retry_wait`

Exceptions:

- `artifact_validate` and `artifact_classify` generally not retried unless
  storage read failed
- `parse_raw` not retried on unsupported or corrupt file errors
- `fuse_gnss_imu` may have `max_attempts = 1` initially due to compute cost,
  later tunable

### 9.2 Timeouts

Each job type should define an expected upper bound and enforce it:

- Soft timeout: worker attempts graceful stop, marks retriable failure
- Hard timeout: operator or watchdog marks as failed or retry_wait

Record duration in `telemetry_job_attempt.metrics_json`.

## 10. Cancellation and user controls

Users can cancel a run from the UI.

Cancellation semantics:

- If job is `queued` or `created`, mark as `cancelled`
- If job is `running`, mark as `cancel_requested` and the worker checks for
  cancellation between safe checkpoints
- Some jobs might not be safely cancellable mid-write, so use checkpoints and
  atomic promotion of outputs

Run cancellation:

- Set run status to `cancelled`
- Cancel all non-started jobs
- For running jobs, request cancellation and wait for acknowledgement, then
  finalise

## 11. Partial success rules

Partial success is a first-class outcome.

Examples:

- Parsing and downsampling succeed, fusion fails, lap detection still runs on
  GNSS only
- Parsing succeeds, lap detection fails, session can still show path, speed, and
  basic charts
- Segment detection skipped, manual segment editing UI is disabled

UI needs structured flags from the run:

- `features_available`: boolean map, for example `laps`, `segments`, `fusion`,
  `lap_compare`
- `feature_reasons`: text codes for why disabled, for example
  `LAP_DETECTION_FAILED`, `NO_IMU_STREAM`

These belong in run summary metadata and are derived from job outcomes.

## 12. Concurrency, prioritisation, and quotas

### 12.1 Concurrency limits

Enforce global and per-user concurrency:

- Global: limit total `running` jobs of heavy types, for example fusion
- Per-user: limit active runs, for example max 2 concurrent runs per user

Implement via:

- Worker-side checks before claiming heavy jobs
- Or DB-side selection that filters based on counts

### 12.2 Prioritisation

Support `priority` on jobs:

- User-triggered interactive uploads get higher priority than backfills
- System maintenance jobs get lower priority

DB poll query sorts by:

- `priority desc`, then `created_at asc`

### 12.3 Quotas

Optional in v1, but design should support:

- Max artifacts per day
- Max total processing time per day
- Storage retention by tier

## 13. Reprocessing and backfill

Reprocessing creates a new processing run:

- New run pins new versions
- Existing session can reference the latest run, but prior runs remain for audit

Reprocess triggers:

- User clicks "Reprocess with latest algorithms"
- System backfill after a bugfix or pipeline change
- Operator-triggered replay for incident recovery

Rules:

- Never overwrite existing derived datasets
- Mark which run is "active" for UI queries, usually the newest successful or
  partial run

## 14. Observability and telemetry

Minimum required metrics:

- Queue depth by job type
- Job duration percentiles by type
- Success, retry, failure counts by type and error code
- Time from upload to publish (SLA)
- Worker heartbeat and stale lock count

Logging requirements:

- Every job attempt logs: run_id, job_id, attempt_number, worker_id
- Structured error codes, not only text messages
- Link logs to attempt records, store `logs_url` if logs are shipped externally

Tracing:

- Add correlation id for the run and propagate to each job attempt

## 15. Security and integrity

- Verify artifact hashes on read when feasible
- Use least privilege credentials for object storage
- Ensure a user can only see their own runs, jobs, and artifacts
- Avoid storing raw location traces in logs

## 16. Example flows

### 16.1 Happy path

1. User uploads artifact(s)
2. System creates `session`, `artifact`, `processing_run`
3. Jobs planned and inserted as `created`
4. Dependencies resolve, jobs move to `queued`
5. Workers process jobs, produce datasets
6. `publish_session` sets run to `succeeded` and session to query-ready

### 16.2 Partial success

- `fuse_gnss_imu` fails with non-retriable error (IMU saturation or inconsistent
  timestamps)
- Run is marked `partial`
- UI shows track path, speed, lap detection if available, but hides
  fusion-dependent screens

### 16.3 Retry scenario

- `downsample_L1` fails due to transient object storage error
- Job moves to `retry_wait` with backoff
- Next attempt succeeds, run continues

## 17. Implementation checklist (v1)

- [ ] Create DB tables for run, job, attempt, derived dataset, artifact
- [ ] Implement planner that creates jobs and dependency edges
- [ ] Implement worker claiming with `SKIP LOCKED`
- [ ] Implement state transitions with strict checks (no illegal transitions)
- [ ] Implement idempotency key computation and atomic output promotion
- [ ] Implement reaper for stale locks
- [ ] Implement run status reducer that derives run status from job outcomes
- [ ] Expose run summary API for UI progress and feature flags

## 18. Future evolutions

- Swap DB queue for Redis or SQS when volume demands it
- Add distributed tracing and richer attempt diagnostics
- Introduce per-stage autoscaling and isolation pools (heavy compute in separate
  worker group)
- Support multi-artifact runs with complex dependencies (for example separate
  IMU file)
- Add resumable uploads and chunked artifact storage
