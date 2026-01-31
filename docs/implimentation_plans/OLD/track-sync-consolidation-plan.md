# Track Sync Consolidation & Performance Plan

**Source Review**: `docs/reviews/track-sync-process-review.md` (2026-02-01)  
**Prepared**: 2026-02-01  
**Owner**: Track Sync Working Group (Ingestion + Web Platform)  
**Objective**: Implement the review recommendations by unifying the track sync
orchestration layer, restoring metadata/report parity, and eliminating the
current performance and observability gaps.

---

## 0. Guiding Goals

1. **Single Code Path** – CLI/cron and admin UI must exercise the same sync
   logic and produce the same data/artifacts.
2. **Full Metadata Coverage** – Every sync run enriches tracks with dashboard
   metadata (or records a structured failure) and emits a Markdown report.
3. **Throughput Improvement** – Reduce a 1,084-track run from ~38 minutes to <10
   minutes via batching/parallelism.
4. **Operational Observability** – Provide progress indicators, metrics, and
   logs that highlight per-stage timing and partial failures.
5. **Resilience** – Add retries/background execution so a sync can recover from
   transient issues and resume without manual intervention.
6. **Documentation/Test Parity** – Architecture docs, ops guides, and automated
   tests must reflect the final design.

---

## 1. Architecture & Service Refactor

### 1.1 Introduce `TrackSyncService`

- **Scope**: New Python module (e.g., `ingestion/services/track_sync.py`)
  exposing
  `async run_sync(include_metadata: bool, report_writer: ReportWriter, progress_sink: ProgressSink)`.
- **Responsibilities**: Fetch LiveRC track list, optionally fetch dashboard
  metadata w/ bounded concurrency, orchestrate Repository upserts, compute
  stats, emit logs/metrics, generate reports.
- **Inputs/Outputs**: Accepts dependency-injected connector, repository, clock,
  report storage, metrics emitter. Returns structured summary (counts, duration,
  report path).
- **Notes**: Service should be pure orchestration so both FastAPI route and CLI
  simply build dependencies then `await service.run_sync(...)`.

### 1.2 Wire Entry Points

- **FastAPI Route** (`ingestion/api/routes.py`): Replace bespoke logic with call
  into `TrackSyncService`. Add ability to request metadata/report generation.
- **CLI Command** (`ingestion/cli/commands.py`): Wrap new service (will
  configure metadata/report, console progress). Remove duplicate logic/stat
  tracking.
- **Cron Script** (`ingestion/scripts/run-track-sync.sh`): Instead of
  `python -m ingestion.cli ...`, call the FastAPI endpoint (or queue worker API)
  so automation and UI use identical plumbing.
- **Config Flags**: Support runtime configuration via env
  (`MRE_TRACK_SYNC_METADATA_ENABLED`, concurrency level, batch size) for rollout
  toggles.

### 1.3 Background Job Execution

- **Job Runner**: Add ingestion worker task (e.g., Celery/RQ or simple asyncio
  background task) that executes `TrackSyncService`. FastAPI route enqueues
  job + returns job ID.
- **Status Endpoint**: Provide `/api/v1/tracks/sync/{jobId}` to fetch progress.
  UI polls and surfaces progress + report link.
- **CLI Compatibility**: CLI command can still call service synchronously for
  local dev/testing, but cron and UI use job queue to avoid HTTP timeouts.

---

## 2. Metadata & Reporting Parity

### 2.1 Dashboard Metadata Integration

- Ensure `TrackSyncService` calls `LiveRCConnector.fetch_track_metadata` for
  each track when `include_metadata=True` (default for all scheduled runs).
- Respect `SitePolicy` concurrency + kill switch. Implement a semaphore-limited
  fan-out (e.g., 6 concurrent HTTP requests) to improve throughput.

### 2.2 Markdown Report Generation

- Extract report writer from CLI command into reusable class (e.g.,
  `TrackSyncReportWriter`). Service invokes writer whenever `report_writer` is
  provided.
- Update FastAPI route response to include `report_path` (or signed URL) so
  admin UI can link to the generated Markdown file.
- Ensure CLI still prints report location and triggers cleanup routine.

### 2.3 Failure Handling

- Track per-track metadata failures separately from overall success. Persist
  structured `metadata_errors[]` in the report so operators see which tracks
  failed enrichment.
- Add retry/backoff for metadata fetches (e.g., up to 2 retries using
  connector). Continue with warnings when retries exhausted.

---

## 3. Performance Improvements

### 3.1 Concurrency Controls

- Introduce asyncio semaphore for dashboard fetches (configurable via env). Use
  `asyncio.gather` to process N tracks concurrently while feeding results back
  to service.
- Consider chunking track list into batches (e.g., 100) to limit memory usage.

### 3.2 Bulk Database Upserts

- Replace per-track `SELECT` + update with SQLAlchemy
  `insert(...).on_conflict_do_update` statements:
  - Build list of `dict` payloads per batch (matching `Track` columns).
  - Use `ON CONFLICT (source, source_track_slug)` to upsert in one roundtrip.
  - Update only changed fields; maintain metadata preservation logic.
- Preload existing `Track` slugs at start (single query) to avoid redundant
  existence checks and to compute `tracks_added` vs `tracks_updated` accurately.

### 3.3 Idle-Time Reduction

- Deactivation Step: Instead of iterating all tracks in Python, use
  `UPDATE tracks SET is_active=false WHERE source='liverc' AND source_track_slug NOT IN (:seen)`
  or mark via timestamp + SQL.
- Stats Computation: Track field-level changes using diffing within the service;
  this allows precise `tracks_updated` counts without repeated DB reads.

### 3.4 SLAs & Monitoring

- Add metrics:
  - Histogram for total runtime, metadata latency, DB batch latency.
  - Counters for metadata failures, retry counts, deactivated tracks.
  - Gauge for in-flight jobs.
- Emit log events per stage start/finish for easier tracing.

---

## 4. Progress Reporting & UX

1. **API Responses**:
   - `POST /api/v1/tracks/sync` returns `{ jobId }`.
   - `GET /api/v1/tracks/sync/{jobId}` returns
     `{ status, processed, total, etaSeconds, reportPath? }`.
2. **Admin UI**:
   - Update `src/components/admin/IngestionControls.tsx` to show a progress bar,
     job status, and report link when finished.
   - Handle error states (retry suggestions, metadata failure summary).
3. **CLI Output**: Mirror the progress data (processed/total) and display
   metadata failure counts.

---

## 5. Resilience & Error Recovery

1. **Retry Strategy**:
   - Leverage connector-level retries plus service-level retries for metadata
     (e.g., requeue individual tracks after transient errors).
   - Distinguish between fatal errors (e.g., schema mismatch) vs recoverable
     network failures.
2. **Checkpointing**:
   - Store `last_successful_sync_at` and track-level `last_seen_at` to support
     resume from the point of failure (e.g., mark batches complete).
   - If a job fails mid-way, provide API to resume using `jobId`.
3. **Alerts**:
   - Trigger alert (PagerDuty/Slack) when job fails or runtime exceeds SLA.

---

## 6. Data Quality & Validation

- Implement validation pipeline for metadata fields (coordinate ranges,
  phone/email formats). Log anomalies and include them in reports.
- Add completeness metrics (percentage of tracks with geo/contact info) and
  track trends over time.
- Consider storing metadata fetch timestamp and source URL hash for auditing.

---

## 7. Documentation & Testing

### 7.1 Documentation

- Update `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md` to
  describe the unified service, background job architecture, and progress
  reporting.
- Refresh `docs/operations/liverc-operations-guide.md` & deployment guides to
  explain cron behavior (now calling API/queue) and report retrieval.
- Document configuration toggles (metadata concurrency, batch sizes, kill
  switch) in `docs/reference_material/configuration.md` (if exists).

### 7.2 Testing

- **Unit Tests**: For `TrackSyncService` covering metadata toggles, batching
  logic, and diff computation.
- **Integration Tests**: Use mocked LiveRC responses + in-memory DB to simulate
  full sync runs (with/without metadata).
- **Performance Tests**: Replay large catalogue in CI nightly to ensure runtime
  under SLA; track metrics.
- **UI Tests**: Update Playwright/Vitest tests to cover progress polling +
  report links in admin console.
- **Migration Tests**: Ensure CLI and cron wrappers still function during
  rollout (A/B testing mode).

---

## 8. Rollout Plan

1. **Phase 0 – Foundations**
   - Build `TrackSyncService`, refactor CLI to use it.
   - Add unit/integration tests.
2. **Phase 1 – API Integration**
   - Update FastAPI route to use service synchronously, enable metadata/report
     parity behind feature flag.
   - Update UI to consume new response shape.
3. **Phase 2 – Background Jobs & Progress**
   - Introduce job queue + status endpoints.
   - Switch UI/cron to async job flow.
4. **Phase 3 – Performance Optimizations**
   - Enable metadata concurrency + bulk upserts.
   - Tune batch sizes using staging runs.
5. **Phase 4 – Observability & Docs**
   - Deploy new metrics, alerting, and documentation updates.
   - Remove legacy CLI direct path once cron verified.
6. **Phase 5 – Clean-up**
   - Retire unused code paths, remove feature flags, finalize test suites.

### Rollback Strategy

- Keep feature flags for metadata concurrency, report writer, and background job
  queue. If issues arise, disable new features to revert to synchronous service
  execution while retaining unified code path.
- Retain CLI fallback (direct service invocation) until background job flow
  proves stable.

---

## 9. Open Questions / Dependencies

1. **Job Queue Selection**: Decide between existing infra (e.g., Sidekiq-like
   service) vs. in-house asyncio workers.
2. **Report Storage**: Continue writing to repo (`docs/reports`) or move to
   object storage (S3) with signed URLs?
3. **DB Impact**: Need migration or indexes to support bulk upserts/deactivation
   query? Confirm with DBA.
4. **Connector Limits**: Verify LiveRC rate limits tolerate higher concurrency;
   coordinate with SitePolicy config.
5. **Security**: Ensure new API endpoints authenticate admin users and protect
   job status info.
6. **Ops Support**: Determine monitoring dashboards + alert routing.

---

## 10. Success Metrics

- **Runtime**: 1,084-track sync completes in <10 minutes (p95) with metadata
  enabled.
- **Parity**: Admin-triggered and cron-triggered runs produce identical
  stats/reports for same time window.
- **Resilience**: No more than 5% of runs fail due to transient network issues;
  automatic retries resolve >80% of transient errors.
- **Observability**: Dashboard displays real-time progress; Ops dashboard shows
  per-stage metrics + SLA compliance.
- **Documentation/Test Coverage**: Architecture/ops docs updated; automated
  tests cover >90% of new orchestration code.

---

## 11. Environment Considerations (Docker-Only Workflow)

- **Containerized Execution**: All ingestion code runs inside the
  `liverc-ingestion-service` container. Updates to cron jobs/CLI should modify
  container entrypoints or Docker health commands, not host scripts.
- **API Access**: Admin UI (Next.js) and ingestion service communicate over the
  Docker network defined in `docker-compose.yml`. Any new job runner
  (queue/worker) must be declared as an additional service/container and wired
  into the compose file.
- **Tooling**: No local npm/pip assumptions—linting/tests should be executed via
  `docker compose exec ...` or scripts already defined in the repo.
- **Configuration**: Environment variables (e.g., metadata concurrency, job
  queue URLs) must be added to the relevant `.env` files and docker-compose
  service definitions.
- **Reports/Artifacts**: If reports move to object storage, ensure the container
  has credentials/mounts; otherwise keep writing to `/app/docs/reports` so
  existing volume mounts still capture the artifacts.
- **Developer Guidance**: Update the quick-start/operations docs to remind
  engineers to build/test via Docker workflows only.
