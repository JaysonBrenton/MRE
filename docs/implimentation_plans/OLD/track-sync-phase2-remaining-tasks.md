# Track Sync Enhancement Plan – Phase 2

**Context**: Phase 1 delivered the shared `TrackSyncService`, unified CLI/API orchestration, async job tracking, and admin UI polling. Remaining items from `docs/reviews/track-sync-process-review.md` still require additional work. This plan scopes Phase 2 tasks to finish the recommendations.

---

## 1. Cron & Job Durability

### 1.1 Move Cron to API/Worker Flow
- Update `ingestion/scripts/run-track-sync.sh` to call the FastAPI `/api/v1/tracks/sync` endpoint (inside the ingestion container) instead of invoking the CLI. Use curl/httpx until a queue client exists.
- Add retry/backoff logic in the script to poll for job completion or log the jobId for ops follow-up.

### 1.2 Persistent Job Store
- Replace the in-memory `TrackSyncJobStore` with a durable backend (PostgreSQL table or Redis). Requirements:
  - Track job metadata (status, stages, report path, error) with TTL/cleanup.
  - Support multiple ingestion instances (horizontal scaling).
  - Provide query/index by `jobId` and creation date for auditing.
- If Redis is chosen, add a new docker-compose service + connection settings; otherwise, create a new SQLAlchemy model + migrations.

### 1.3 CLI/Job Integration
- Add CLI command `liverc track-sync status --job-id <id>` that calls the same status endpoint, so operators can monitor cron jobs from the container.
- Enhance logging to print jobId when triggered from cron, and to log final status when the job completes.

---

## 2. Performance Optimizations

### 2.1 Bulk Upserts
- Implement batched `INSERT ... ON CONFLICT DO UPDATE` operations in `TrackSyncService`:
  - Gather track payloads into chunks (e.g., 200) and execute via SQLAlchemy Core.
  - Only update changed columns and maintain metadata preservation semantics.
  - Remove per-track `SELECT` queries once slug prefetch is complete.

### 2.2 SQL Deactivation
- Replace Python loop with SQL update: set `is_active=false` for LiveRC tracks whose `source_track_slug` not in current run (or compare `last_seen_at`). Use a temporary table or `WHERE last_seen_at < :cutoff` approach.

### 2.3 Stage-Level Metrics & Alerts
- Emit metrics via existing telemetry (structlog/metrics module): per-stage duration, metadata failure rate, throughput (tracks/min). Each cron run should log metrics and, ideally, push to monitoring.
- Hook alerts when runtime exceeds SLA or metadata failure rate crosses a threshold (PagerDuty/Slack integration via Ops tooling).

---

## 3. Resilience & Error Recovery

### 3.1 Retry/Resume Support
- Add service-level retry/backoff for metadata fetches beyond connector-level attempts. Track retries per slug.
- Store checkpoint metadata (e.g., processed slug list) so a failed job can resume without starting over.
- Expose an API to resume a failed job (`POST /tracks/sync/{jobId}/resume`).

### 3.2 Cancellation
- Allow admins to cancel a long-running job (`DELETE /tracks/sync/{jobId}`), ensuring background tasks terminate gracefully and DB session rolls back.

---

## 4. Documentation & Testing

### 4.1 Docs
- Update architecture docs (especially `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md`) to describe the background job flow, persistence layer, and cron interaction.
- Refresh operations/deployment guides with new env vars, docker-compose services, and runbooks for monitoring job IDs.
- Document CLI usage for status checks and cron invocation.

### 4.2 Automated Tests
- **Unit Tests**: Cover new job store implementation, TrackSyncService batch upserts, resume/cancel paths.
- **Integration Tests**: Exercise the FastAPI routes including job creation, polling, cancel/resume, and metadata toggles. Run inside Docker CI to keep parity with production.
- **Performance Tests**: Add a nightly job that syncs a large fixture dataset to verify runtime improvements and catch regressions.

---

## 5. Dependencies & Decisions

1. **Job Storage Choice**: Decide between Redis vs. PostgreSQL for persistence. Consider existing infra, ops preference, and ease of monitoring.
2. **Queue Framework**: Evaluate whether background jobs should move to a formal task queue (Celery/RQ/BullMQ) vs. custom asyncio tasks.
3. **Monitoring Stack**: Align with ops team on metric sinks (Datadog/Prometheus) for new telemetry.
4. **Security**: Ensure new endpoints (status/resume/cancel) remain admin-only; update threat model accordingly.
5. **Env Config**: Plan migrations for new env vars (job store URLs, concurrency/batch size settings) and update `.env`/compose files.

---

## 6. Rollout Strategy

1. **Prototype**: Build persistent job store + CLI status command in a feature branch; test locally in Docker.
2. **Deploy Stage**: Roll out to staging, have cron call the API while keeping CLI fallback.
3. **Enable Bulk Upserts**: Behind feature flag; monitor DB metrics.
4. **Enable SQL Deactivation**: Validate on staging DB to avoid mass updates.
5. **Launch**: Switch production cron to API flow once metrics/alerts confirm stability; document procedures for operators.
6. **Cleanup**: Remove deprecated CLI logic and in-memory job store code.

---

## 7. Success Metrics

- 1,000+ track sync completes in <10 minutes (p95) with metadata enabled.
- 0 cron runs fail due to HTTP timeouts (background job handles long durations).
- Job status persists across container restarts; operators can query history for 7+ days.
- Alerts fire on SLA breaches; documentation/runbooks up to date.
- Automated test coverage includes new batch/resume paths.

