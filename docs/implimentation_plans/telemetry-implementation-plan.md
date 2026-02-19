# Telemetry Implementation Plan

**Created:** 2026-02-16  
**Design reference:** [docs/telemetry/Design/Telemetry_Implementation_Design.md](../telemetry/Design/Telemetry_Implementation_Design.md)  
**Owner:** Telemetry / Backend + Frontend  
**Objective:** Implement MRE telemetry ingest, storage, and display in phases (MVP → v1 → v2). This plan adds prerequisites, phase dependencies, infrastructure, config, task-level steps for MVP, testing, documentation, and operations so implementers can start work without ambiguity.

---

## Executive Summary

This plan implements the behaviour described in the [Telemetry Implementation Design](../telemetry/Design/Telemetry_Implementation_Design.md): control plane (Next.js) for auth, session CRUD, upload API, and signed URLs; compute plane (Python) for parse, normalise, canonical Parquet write, optional downsampling/fusion/lap detection, and ClickHouse materialisation. Storage: Postgres (metadata), object storage (Parquet canonical), ClickHouse (derived cache for queries).

**Phases (dependency-ordered):** (0) Prerequisites and conventions. (1) Infrastructure and runtime: object storage, job queue, worker topology. (2) MVP schema (Postgres), upload API, pipeline skeleton, artifact validate/classify. (3) MVP parsers (CSV, GPX Level 1), canonical Parquet write (GNSS PVT), basic session list UI. (4) Testing for MVP. (5) Documentation updates. (6) Runbooks, observability, release verification. v1 and v2 are scoped in the design doc; this plan expands MVP into tasks and sets the pattern for later phases.

**Emphasis:** Every phase has explicit exit criteria; infrastructure and config are specified so Docker and env are unambiguous; documentation lists every doc to update; testing covers happy path, malformed input, and idempotency.

**MVP implementation decisions:** Gaps (job table, upload/artifact lifecycle, storage path, session time, fixtures, dependencies, error response, naming, sharing) are resolved in [docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md). That document is authoritative for MVP schema and behaviour.

---

## 0. Prerequisites and Conventions

- **Codebase authority:** File paths, method names, and "current state" are verified against the repo. When in doubt, grep/read before implementing.
- **Docker-only:** All test and run commands assume execution inside the appropriate container (`mre-app` for Next.js, `mre-liverc-ingestion-service` for Python unless a dedicated telemetry worker is introduced). See [docs/AGENTS.md](../AGENTS.md) and [docs/operations/docker-user-guide.md](../operations/docker-user-guide.md).
- **Testing:** Unit and integration tests live under `ingestion/tests/` (Python) and `src/__tests__/` (Next.js). Telemetry fixtures under `ingestion/tests/fixtures/telemetry/`. Follow [docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md) for fixture-based, deterministic tests. Run Python tests: `docker exec -it mre-liverc-ingestion-service pytest ingestion/tests/ -v --tb=short`. Run Next.js tests: `docker exec -it mre-app npm test`.
- **Schema and migrations:** Telemetry tables do not yet exist in the repo. All schema changes use Prisma migrations under `prisma/migrations/`. The same Postgres is used by Next.js (Prisma) and by the Python service (SQLAlchemy or direct client). If the Python service uses SQLAlchemy for telemetry, models must stay in sync with migrated schema. Document any new migration in [docs/database/schema.md](../database/schema.md).
- **Documentation:** Every doc touched in this plan is listed in Phase 5 with the exact updates required. No doc left behind. When implementation is merged, set the design doc status to *Implemented* (or *In progress*) and link this plan.

---

## 1. Phase Overview and Dependencies

| Phase | Description | Depends on |
|-------|-------------|------------|
| **Phase 1** | Infrastructure and runtime (object storage, job queue, worker) | — |
| **Phase 2** | MVP: Postgres schema (telemetry_sessions, artifacts, devices), upload API, pipeline skeleton, validate/classify | Phase 1 |
| **Phase 3** | MVP: CSV + GPX parsers (Level 1), canonical Parquet write (gnss_pvt), basic session list UI | Phase 2 |
| **Phase 4** | Testing (MVP: unit parsers, integration upload→session list) | Phase 3 |
| **Phase 5** | Documentation updates (comprehensive) | Phase 3 |
| **Phase 6** | Runbooks, observability, release verification | Phase 4, 5 |

v1 (all text parsers, fusion, lap detection, ClickHouse, quality) and v2 (binary parsers, track SFL, etc.) are defined in the [Telemetry Implementation Design §9](../telemetry/Design/Telemetry_Implementation_Design.md#9-implementation-roadmap); implement v1/v2 by repeating the same pattern: dependency table, tasks with file paths, exit criteria, testing, docs, operations.

---

## 2. Infrastructure and Runtime

### 2.1 Object storage (Parquet canonical)

- **Purpose:** Store canonical time-series Parquet files per session/run. Authority per [ADR-20260203](../../adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md).
- **Options:** S3 or S3-compatible (MinIO, localstack for dev). Path layout: `{tenant_id}/{driver_id}/{session_id}/{run_id}/gnss_pvt.parquet` etc. (see Implementation Design §3.6).
- **Who writes:** Python compute plane (after parse + normalise). Next.js does not write Parquet.
- **Who reads:** Next.js mints signed GET URLs for export; Python materialise job reads to populate ClickHouse (v1).
- **Env vars (recommended):** `TELEMETRY_OBJECT_STORAGE_ENDPOINT`, `TELEMETRY_OBJECT_STORAGE_BUCKET`, `TELEMETRY_OBJECT_STORAGE_ACCESS_KEY`, `TELEMETRY_OBJECT_STORAGE_SECRET_KEY` (or use existing app object-storage env if shared). Document in [docs/operations/environment-variables.md](../operations/environment-variables.md).
- **MVP:** If no shared object store exists, support a "local path" mode for dev (e.g. `TELEMETRY_PARQUET_PATH=/data/telemetry`) so tests and dev can run without S3. Production must use object storage.

### 2.2 Job queue

- **Authority:** [Telemetry Processing Pipeline Job Orchestration and State Machine](../telemetry/Design/Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md).
- **Implementation:** Postgres-backed queue. Table(s): e.g. `telemetry_jobs` (id, type, payload JSONB, status, claimed_at, created_at, updated_at). Claim via `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Who enqueues:** Next.js API (after upload finalise): insert row(s) for artifact_validate, artifact_classify, parse_raw, etc., or a single "intake" job that the worker expands.
- **Who claims:** Python worker. Same Postgres as app.
- **Worker process:** MVP: same container as LiveRC ingestion service (`mre-liverc-ingestion-service`) with a separate worker loop or CLI command that polls the queue. Alternative: new container `mre-telemetry-worker` that only runs the telemetry job loop. Document choice in operations guide.
- **Schema:** Use the single-table `telemetry_jobs` schema from [Concrete Data Model §7.4](../telemetry/Design/Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md) and [Telemetry MVP Implementation Decisions §1](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md). Job types for MVP: artifact_validate, artifact_classify, parse_raw (and optionally normalise_units, time_align for MVP if minimal).

### 2.3 ClickHouse (v1 only)

- **MVP:** Not required. Session list and session detail (metadata) come from Postgres. Time-series reads in v1 will need ClickHouse or a fallback (e.g. read small windows from Parquet via API).
- **v1:** ClickHouse for interactive time-series queries. Run in Docker (add service to docker-compose or document external). Schema applied via migration scripts or init SQL. Connection from Python materialise job only. Env: `TELEMETRY_CLICKHOUSE_URL` (or host/port/user/password). Document in environment-variables and operations guide.

### 2.4 Exit criteria (infrastructure)

- [ ] Object storage (or local path) configured; env vars documented; Python can write a test Parquet file and Next.js can mint a signed URL (or skip signed URL for MVP if not implemented).
- [ ] Job queue table(s) created; Next.js can enqueue a job; Python worker can claim and mark complete.
- [ ] Worker topology documented (same container vs new); runbook mentions how to restart workers.

---

## 3. Config and Environment

| Config / env | Purpose | Default / notes |
|--------------|---------|------------------|
| `TELEMETRY_OBJECT_STORAGE_*` or `TELEMETRY_PARQUET_PATH` | Where to write/read Parquet | Required for production; local path for dev |
| `TELEMETRY_JOB_QUEUE_TABLE` | Postgres table name for jobs | e.g. `telemetry_jobs` |
| Downsample level mapping (L0/L1/L2 ↔ ds_50hz/ds_10hz/ds_1hz) | API and pipeline | Config file or env; document in Implementation Design §10.1 |
| Quality thresholds (lap_timing ≥ 55, etc.) | Feature gating | Config or constants; see Implementation Design §7.6 |
| `TELEMETRY_MAX_FILE_SIZE_BYTES`, `TELEMETRY_PARSER_TIMEOUT_SEC` | Parser safety | Optional; document in Supported Formats / ops |
| v1: `TELEMETRY_CLICKHOUSE_URL` | ClickHouse connection | v1 only |

Add these to [docs/operations/environment-variables.md](../operations/environment-variables.md) as they are introduced.

---

## 4. Phase 2 — MVP: Schema, API, Pipeline Skeleton

**Goal:** Postgres metadata for sessions, artifacts, devices; upload API (POST uploads, finalise); pipeline skeleton so that after finalise a job is enqueued and a worker can run validate → classify → parse (stub) and write canonical Parquet (gnss_pvt).

### 4.1 Tasks

1. **Postgres schema (Prisma).**
   - Add tables per [Concrete Data Model §7](../telemetry/Design/Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md) and [Telemetry MVP Implementation Decisions](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md): telemetry_sessions, telemetry_artifacts (with storagePath; sessionId nullable until finalise), telemetry_devices, telemetry_processing_runs, telemetry_jobs. Omit teams and sharing tables for MVP. Use Prisma migration: `prisma/migrations/YYYYMMDDHHMMSS_add_telemetry_tables/migration.sql`.
   - Update `prisma/schema.prisma` with TelemetrySession, TelemetryArtifact, TelemetryDevice, TelemetryProcessingRun (and TelemetryJob if separate). Run `npx prisma generate` in container.
   - Document in [docs/database/schema.md](../database/schema.md).

2. **Upload API (Next.js).**
   - Implement `POST /api/v1/telemetry/uploads`: create artifact row (sessionId null, status UPLOADED), write raw file to storage, set artifact.storagePath, return upload id (= artifact id) and signed PUT URL or accept body. See [API Contract](../telemetry/Design/API_Contract_Telemetry.md) and [Telemetry MVP Implementation Decisions §2, §3](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md).
   - Implement `POST /api/v1/telemetry/uploads/{id}/finalise`: create session (start/end time = placeholder per MVP Decisions §4), set artifact.sessionId, create processing run, enqueue job(s), return session_id. When status is failed, GET session must return failure: { code, message } per MVP Decisions §7.
   - Auth: require authenticated user; scope sessions by user/tenant.

3. **Pipeline skeleton (Python).**
   - Location: new module under `ingestion/` (e.g. `ingestion/telemetry/` or `ingestion/ingestion/telemetry_pipeline.py`). Worker loop: poll job table, claim job, dispatch by type (artifact_validate, artifact_classify, parse_raw). artifact_validate: check file exists, size, optional checksum. artifact_classify: detect format (CSV vs GPX for MVP), set artifact metadata. parse_raw: call parser (stub or real CSV/GPX in Phase 3), then write canonical Parquet (Phase 3). For Phase 2, parse_raw can stub "no-op" or minimal CSV read and write one Parquet file.
   - Ensure worker can read uploaded file (path or object storage GET). Ensure worker can write to Parquet path (object storage or local).

4. **Session GET and list (Next.js).**
   - `GET /api/v1/telemetry/sessions`: list sessions for user (filter by status, optional track/date). Return session id, status, created_at, currentRunId.
   - `GET /api/v1/telemetry/sessions/{id}`: session detail (metadata from Postgres). Return processing_run_id, schema_version, materialisation_status when available.

### 4.2 Exit criteria

- [ ] Migration applied; telemetry_* tables exist. Job table exists and is documented.
- [ ] POST uploads + finalise create session and enqueue job(s). Worker claims and runs validate → classify → parse_raw (stub); session status updated.
- [ ] GET sessions and GET sessions/{id} return correct metadata. No new linter/type errors; existing tests pass.

---

## 5. Phase 3 — MVP: Parsers, Parquet, Session List UI

**Goal:** CSV and GPX parsers (Level 1: import and display); canonical Parquet write (gnss_pvt.parquet); basic session list UI so user can upload a file, see processing complete, and see session in list.

### 5.1 Tasks

1. **Parser plugin contract and registry.**
   - Define `ParserPlugin` interface: `detect(artifact_set) -> float`, `parse(artifact_set, options) -> ParseResult`. ParseResult: device_family, device_model, capabilities, streams (gnss_pvt, …), warnings, errors, provenance. See Implementation Design §4.6 and [Supported Formats §8](../telemetry/Design/Supported%20Formats%20and%20Parser%20Specification.md).
   - Location: e.g. `ingestion/telemetry/parsers/base.py`, `ingestion/telemetry/parsers/registry.py`. Classifier: select parser with highest detect score above threshold.

2. **CSV parser (Level 1).**
   - File: `ingestion/telemetry/parsers/csv_parser.py`. Support at least: timestamp (or time_ms), lat, lon, optional alt, speed. Output canonical stream gnss_pvt (t, lat_deg, lon_deg, alt_m, speed_mps, …). Handle delimiter, header row. Emit stable error codes (e.g. CSV_NO_TIME_COLUMN, CSV_MISSING_LAT_LON). Unit test with fixture `ingestion/tests/fixtures/telemetry/sample_gnss_10hz.csv`.

3. **GPX parser (Level 1).**
   - File: `ingestion/telemetry/parsers/gpx_parser.py`. Parse trkpt lat/lon, ele, time; optional extensions for speed. Output gnss_pvt. Emit GPX_MISSING_TIME if no time. Unit test with fixture `ingestion/tests/fixtures/telemetry/sample_track.gpx`.

4. **Canonical Parquet write.**
   - After parse_raw, write streams to Parquet. Path: `{tenant_id}/{driver_id}/{session_id}/{run_id}/gnss_pvt.parquet`. Use canonical column names and units (Implementation Design §3.7). Python: use pyarrow or pandas to write Parquet. Create directory/key prefix if needed. Update processing run with output dataset IDs or paths in Postgres.

5. **Basic session list UI.**
   - Page or section: list telemetry sessions (from GET /api/v1/telemetry/sessions). Show session id, status, created_at. Link to session detail (detail can be placeholder for MVP). Upload: button or drop zone that calls POST uploads, uploads file, calls finalise, then polls GET session until status READY or FAILED.

### 5.2 Exit criteria

- [ ] CSV and GPX parsers registered; classifier selects correct parser for fixture files. Unit tests pass.
- [ ] End-to-end: upload CSV → finalise → worker runs → gnss_pvt.parquet written; session status READY. Session appears in list UI.
- [ ] Malformed CSV (e.g. no time column) produces error reason code and session status FAILED or PARTIAL; no crash.

---

## 6. Phase 4 — Testing (MVP)

**Goal:** Unit tests for parsers and classifier; integration test for upload → validate → classify → parse → Parquet write → session list; fixture-based and deterministic.

### 6.1 Unit tests

| Test file / scope | Cases |
|-------------------|--------|
| CSV parser | Valid fixture → ParseResult with gnss_pvt stream, has_gnss_position true. No time column → error code CSV_NO_TIME_COLUMN. Empty file → error or empty streams. |
| GPX parser | Valid fixture → gnss_pvt with lat/lon/time. Missing time → GPX_MISSING_TIME. |
| Classifier | Given artifact set, returns correct parser (CSV vs GPX) and score above threshold. |

### 6.2 Integration tests

| Scenario | Setup | Assertions |
|----------|--------|-------------|
| Happy path | Upload CSV fixture, finalise, run worker. | Session created; job(s) run; gnss_pvt.parquet exists (or metadata points to it); session status READY. GET sessions includes session. |
| Idempotency | Same file uploaded twice (same checksum). | Per design: either same session/artifact reused or duplicate prevented by idempotency key (artifact sha256). No duplicate sessions with same content. |
| Malformed | Upload CSV with no timestamp column. | Worker completes; session status FAILED or artifact status invalid; reason code in response or logs. |

### 6.3 Fixtures

Commit these three files under `ingestion/tests/fixtures/telemetry/` and use them in parser unit tests and integration tests. See [Telemetry MVP Implementation Decisions §5](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md).

| Fixture | Purpose |
|---------|---------|
| `ingestion/tests/fixtures/telemetry/sample_gnss_10hz.csv` | Valid 10 Hz GNSS CSV (timestamp or timestamp_ms, lat, lon, optional alt, speed). Parser must produce gnss_pvt. |
| `ingestion/tests/fixtures/telemetry/sample_track.gpx` | Valid GPX track with trkpt, ele, time. Parser must produce gnss_pvt. |
| `ingestion/tests/fixtures/telemetry/csv_no_time.csv` | CSV with lat, lon, speed but no time column. Parser must emit error code CSV_NO_TIME_COLUMN. |

### 6.4 Exit criteria

- [ ] All unit tests pass. Integration test (happy path) passes in container. Idempotency and malformed cases covered.
- [ ] Fixtures committed; referenced in tests. Run: `docker exec -it mre-liverc-ingestion-service pytest ingestion/tests/ -v -k telemetry` (or equivalent).

---

## 7. Phase 5 — Documentation Updates

**Goal:** Update every affected document so architecture, operations, API, and schema reflect telemetry MVP. No doc left behind.

### 7.1 Architecture and design

| Document | Updates |
|----------|--------|
| [docs/telemetry/Design/Telemetry_Implementation_Design.md](../telemetry/Design/Telemetry_Implementation_Design.md) | Set status to *In progress* for MVP; add "Implementation plan: docs/implimentation_plans/telemetry-implementation-plan.md". |
| [docs/telemetry/README.md](../telemetry/README.md) | Implementation order already points to Implementation Design; add one line: "Task-level plan: docs/implimentation_plans/telemetry-implementation-plan.md". |

### 7.2 Operations and runbooks

| Document | Updates |
|----------|--------|
| [docs/operations/environment-variables.md](../operations/environment-variables.md) | Add TELEMETRY_* env vars (object storage or Parquet path, job queue table, optional parser limits). |
| [docs/operations/docker-user-guide.md](../operations/docker-user-guide.md) | If new container (telemetry worker): add service, ports, env. If same container: note that telemetry worker runs in ingestion service. |
| [docs/telemetry/Design/Operational Runbook.md](../telemetry/Design/Operational%20Runbook.md) | Add or update: "Telemetry upload and processing"; "Stuck jobs" (claim/retry); "Parquet write failures" (permissions, disk); "Session list empty" (check job status, worker running). |

### 7.3 API and database

| Document | Updates |
|----------|--------|
| [docs/api/api-reference.md](../api/api-reference.md) or telemetry API doc | Document POST /api/v1/telemetry/uploads, POST …/finalise, GET /api/v1/telemetry/sessions, GET …/sessions/{id}. Request/response shapes per [API Contract](../telemetry/Design/API_Contract_Telemetry.md). |
| [docs/database/schema.md](../database/schema.md) | Add telemetry_* tables (sessions, artifacts, devices, processing_runs, jobs). Column summary and purpose. |

### 7.4 Index and references

| Document | Updates |
|----------|--------|
| [docs/index/document-index.md](../index/document-index.md) | Under Implementation Plans, add link to "Telemetry Implementation Plan" with short description. |

### 7.5 Exit criteria

- [ ] Every document in the tables above updated and reviewed. Design doc status set to *In progress*. Document index includes this plan.

---

## 8. Phase 6 — Runbooks, Observability, Release Verification

**Goal:** Runbook entries for telemetry processing; metrics and logs for MVP; release verification checklist.

### 8.1 Runbook

- **Upload and process:** User uploads file → finalise → worker runs. Verification: GET session by id; status READY; list sessions shows session.
- **Troubleshooting:** "Session stuck in PROCESSING" → check worker running, job table for claimed/failed jobs; "Upload failed" → check auth, file size limit, object storage credentials; "Parser error" → check artifact format, logs for reason code (CSV_NO_TIME_COLUMN etc.).

### 8.2 Observability

- **Logs:** Structured logs for job start/complete/fail (job_type, session_id, artifact_id, error code). Emit from Python worker per [ingestion/common/logging.py](../../ingestion/common/logging.py) and structlog.
- **Metrics:** Optional for MVP: counter telemetry_jobs_total (by type, status), telemetry_upload_total (by outcome). Add to [ingestion/common/metrics.py](../../ingestion/common/metrics.py) if present; document in [docs/operations/observability-guide.md](../operations/observability-guide.md).

### 8.3 Release verification checklist

- [ ] Migration applied; telemetry_* and job table exist.
- [ ] Upload one CSV (e.g. fixture) via API or UI; finalise; worker processes; session status READY; session appears in list.
- [ ] GET /api/v1/telemetry/sessions returns session; GET /api/v1/telemetry/sessions/{id} returns detail.
- [ ] Re-upload same file; idempotency as designed (no duplicate session or artifact).
- [ ] Docs and runbooks updated; linked from index. Tests green in CI.

---

## 9. References

- Design: [docs/telemetry/Design/Telemetry_Implementation_Design.md](../telemetry/Design/Telemetry_Implementation_Design.md)
- API Contract: [docs/telemetry/Design/API_Contract_Telemetry.md](../telemetry/Design/API_Contract_Telemetry.md)
- Concrete Data Model: [docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md](../telemetry/Design/Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md)
- Pipeline and state machine: [docs/telemetry/Design/Telemetry Processing Pipeline Job Orchestration and State Machine.md](../telemetry/Design/Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md)
- Supported Formats and parsers: [docs/telemetry/Design/Supported Formats and Parser Specification.md](../telemetry/Design/Supported%20Formats%20and%20Parser%20Specification.md)
- ADR storage: [docs/adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md](../../adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md)
- Review: [docs/reviews/telemetry-implementation-plan-review.md](../reviews/telemetry-implementation-plan-review.md)
