---
created: 2026-06-07
owner: Platform / Observability
lastModified: 2026-06-07
purpose:
  Phased implementation plan to migrate MRE from Alpha console/DB logging to
  OpenTelemetry instrumentation and a third-party observability SaaS platform.
  Implements ADR-20260607 and architecture docs observability-*.
relatedDocs:
  - docs/adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md
  - docs/architecture/observability-platform.md
  - docs/architecture/observability-log-schema.md
  - docs/architecture/observability-correlation-and-tracing.md
  - docs/architecture/observability-sampling-retention-and-privacy.md
  - docs/operations/observability-platform-setup-runbook.md
  - docs/operations/observability-alerting-runbook.md
  - docs/AGENTS.md
status: Planned — Phase 0 documentation complete; code phases not started
---

# Observability Platform Remediation — Implementation Plan (June 2026)

Implements
[ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)
and the normative architecture documents under
`docs/architecture/observability-*.md`.

All commands are **Docker-only** per [AGENTS.md](../AGENTS.md).

---

## Goals

| #   | Goal                      | Success criterion                                                                               |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| G1  | Cross-service correlation | Same `trace_id` in mre-app and ingestion logs for one ingest API call                           |
| G2  | SaaS log visibility       | Staging logs searchable by `service`, `ingestion.event_id`, `error.code` within 2 min           |
| G3  | Error tracking            | Unhandled API + client errors appear in Sentry or Datadog Error Tracking                        |
| G4  | Metrics scrape            | `GET http://localhost:8000/metrics` returns Prometheus text; key counters non-zero after ingest |
| G5  | Cost control              | Production `ApplicationLog` writes warn+error only; ingestion sampling at 10%                   |
| G6  | Operator readiness        | Alerts fire in staging for synthetic failure; runbooks published                                |
| G7  | No dev friction           | `OBSERVABILITY_ENABLED=false` — zero SaaS calls, existing console logging works                 |

---

## Phase 0 — Documentation and decisions (this PR)

**Status:** In progress

### 0.1 Deliverables

- [x] ADR-20260607
- [x] Architecture: observability-platform, log-schema, correlation, privacy
- [x] Implementation plan (this document)
- [x] Runbooks: setup, alerting
- [x] Update `docs/architecture/logging.md`
- [x] Update `docs/operations/observability-guide.md`
- [x] Update `docs/architecture/liverc-ingestion/15-ingestion-observability.md`
      cross-refs
- [x] Update `docs/implimentation_plans/README.md` and `docs/README.md`
- [ ] Update `docs/operations/build-runtime-reference.md` when env vars ship in
      code (Phase 2)

### 0.2 Decisions to lock before Phase 1 coding

| Decision                | Options                                    | Recommendation                                               |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Primary SaaS            | Datadog vs Grafana Cloud + Sentry          | **Datadog** for final release unless budget dictates Grafana |
| Error UX                | Datadog Error Tracking vs Sentry           | Sentry if Grafana path; Datadog native if Datadog path       |
| OTel vs dd-trace only   | OTel SDK + OTLP vs vendor-native           | **OTel** with Datadog OTLP intake or dd-trace OTel bridge    |
| JSON stdout for Next.js | Replace `formatLogEntry` vs dual format    | Single JSON in production only                               |
| Request ID generator    | Custom regex UUID vs `crypto.randomUUID()` | **`crypto.randomUUID()`** in Node 18+                        |

Record final choice in ADR status → **Accepted**.

---

## Phase 1 — Correlation and error tracking

**Maps to:** G1, G3, G7  
**Estimated effort:** 1–2 weeks

### 1.1 Shared HTTP propagation (TypeScript)

**New file:** `src/lib/observability/http-propagators.ts`

```typescript
export function propagationHeaders(ctx: {
  requestId: string
  userId?: string
}): Record<string, string>
```

- Read active OTel span context when available
- Build W3C `traceparent` header
- Always set `X-Request-ID`

**Modify:**

| File                                            | Change                                                          |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/ingestion-client.ts`                   | Merge `propagationHeaders()` into all `fetch` calls             |
| `src/core/admin/ingestion.ts`                   | Replace raw `fetch` with helper or `IngestionClient`            |
| `src/core/practice-days/ingest-practice-day.ts` | Same                                                            |
| `src/lib/request-context.ts`                    | Use `crypto.randomUUID()`; export `getRequestId()` from storage |

**Acceptance:**

```bash
# After triggering ingest via API, ingestion logs contain request id
docker logs mre-liverc-ingestion-service 2>&1 | tail -100 | grep -F "<request-id-from-response-header>"
```

### 1.2 Ingestion trace middleware (Python)

**New file:** `ingestion/common/request_context.py`

- Contextvars: `request_id`, `trace_id`, `span_id`
- Middleware function for FastAPI

**Modify:**

| File                          | Change                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| `ingestion/api/app.py`        | Add middleware: extract `traceparent`, `X-Request-ID`; bind structlog |
| `ingestion/common/logging.py` | Processor injects contextvars into every log line                     |
| `ingestion/api/job_queue.py`  | Store `request_id`, `traceparent` in job metadata; restore on execute |

**Acceptance:**

- Unit test: middleware parses sample `traceparent`
- Integration test: POST with headers → log output contains `request_id`

### 1.3 Error tracking bootstrap (Next.js)

**Datadog path:**

- Add `dd-trace` init in `src/instrumentation.ts`
- Hook `logger.error` to record exception if not already captured

**Grafana + Sentry path:**

- `@sentry/nextjs` in `next.config.ts` + `sentry.client.config.ts` /
  `sentry.server.config.ts`
- `GlobalErrorHandler.tsx` → `Sentry.captureException`

**Env gating:**

```typescript
if (process.env.OBSERVABILITY_ENABLED === "true") { ... }
```

**Acceptance:**

```bash
# Throw test error route in staging only
curl -X POST http://localhost:3001/api/v1/admin/... # test endpoint
# Error appears in SaaS within 5 minutes
```

### 1.4 Tests

| Test                      | Location                                                        |
| ------------------------- | --------------------------------------------------------------- |
| `propagationHeaders` unit | `src/__tests__/lib/http-propagators.test.ts`                    |
| Ingestion middleware      | `ingestion/tests/unit/test_request_context_middleware.py`       |
| Correlation integration   | `ingestion/tests/integration/test_observability_correlation.py` |

**Phase 1 exit:** G1 + G3 + G7 verified in Docker staging.

---

## Phase 2 — Log platform and schema normalisation

**Maps to:** G2, G5  
**Estimated effort:** 2–3 weeks

### 2.1 Next.js JSON logging

**Modify `src/lib/logger.ts`:**

- Production: emit single-line JSON matching
  [observability-log-schema.md](../architecture/observability-log-schema.md)
- Add `env`, `version` from env vars
- Map `LogContext` → snake_case schema fields
- Respect `APPLICATION_LOG_PERSIST_LEVELS` when `OBSERVABILITY_ENABLED=true`

### 2.2 Python schema processor

**Modify `ingestion/common/logging.py`:**

```python
def normalize_mre_log_schema(logger, method_name, event_dict):
    """Rename keys to schema; inject service, env, version."""
```

Set `service=liverc-ingestion` or read from `OTEL_SERVICE_NAME`.

### 2.3 Sampling processor

**New:** `ingestion/common/log_sampling.py`

- Implement rules from
  [observability-sampling-retention-and-privacy.md](../architecture/observability-sampling-retention-and-privacy.md)
- Register in structlog processor chain **before** JSONRenderer

### 2.4 Docker log shipping

**Modify `docker-compose.yml`:**

- Add `datadog-agent` service (or `grafana/alloy`)
- Add container labels for log source/service
- Document env vars in `.env.docker.example`

**Setup steps:**
[observability-platform-setup-runbook.md](../operations/observability-platform-setup-runbook.md)

### 2.5 SaaS log pipelines

Configure in vendor UI (document screenshots/checklist in runbook):

- JSON parsing
- Facets for `ingestion.event_id`, `error.code`, `request_id`
- Exclude healthcheck noise

**Phase 2 exit:** G2 + G5 — staging logs in SaaS; production config reviewed.

---

## Phase 3 — Metrics and distributed tracing

**Maps to:** G4, G1 (trace UI)  
**Estimated effort:** 2–4 weeks

### 3.1 Expose Prometheus `/metrics`

**Modify `ingestion/api/app.py`:**

```python
from prometheus_client import make_asgi_app
from ingestion.common.metrics import REGISTRY

metrics_app = make_asgi_app(registry=REGISTRY)
app.mount("/metrics", metrics_app)
```

Secure for production: internal network only or auth sidecar (document in
runbook).

**Verify:**

```bash
docker exec mre-liverc-ingestion-service curl -s http://localhost:8000/metrics | grep ingestion_duration_seconds
```

### 3.2 Metric label cardinality refactor

**Modify `ingestion/common/metrics.py`:**

| Current                                                  | Target                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `ingestion_duration_seconds{event_id, track_id, result}` | Remove `event_id`; keep `result`, optional `track_slug` |
| `race_fetch_duration_seconds{event_id, race_id, method}` | `{method, result}` only                                 |

Add `ingestion_event_duration_seconds` log or trace attribute for per-event
timing.

**Migration:** Document dashboard query changes in alerting runbook.

### 3.3 OpenTelemetry spans

**Node:**

- `src/instrumentation.ts` — NodeSDK, HTTP instrumentation
- Manual span around `IngestionClient.performIngestionRequest`

**Python:**

- `ingestion/common/telemetry.py` — FastAPI + httpx instrumentation
- Replace or wrap `ingestion/common/tracing.py` TraceSpan with OTel

**Queue:** Child span links to parent via restored context.

### 3.4 Agent APM

- Enable APM in Datadog agent **or** OTLP export to Grafana Tempo
- Verify flame graph for ingest path

### 3.5 Dashboards (minimum)

Create in SaaS (IDs documented in runbook):

1. **MRE API** — RPS, p95 latency, error rate by route
2. **Ingestion** — success/fail count, p95 duration, lock timeouts, connector
   errors
3. **Infrastructure** — container CPU/memory

**Phase 3 exit:** G4 + trace UI for full ingest path.

---

## Phase 4 — Production hardening

**Maps to:** G6  
**Estimated effort:** 1–2 weeks

### 4.1 Alerts

Implement monitors per
[observability-alerting-runbook.md](../operations/observability-alerting-runbook.md).

Validate each fires in staging with synthetic triggers.

### 4.2 ApplicationLog retention job

- Script or cron: delete `ApplicationLog` older than 30 days
- Document in operations guide

### 4.3 Admin UI

- `/admin/logs` — show `trace_id` / link to SaaS when configured
- Banner: "Full logs available in [Observability Platform]"

### 4.4 Lint / CI

- ESLint rule or grep: discourage raw `console.log` in `src/app/api` and
  `src/core`
- Python: reject `print(` in `ingestion/` (except CLI progress)

### 4.5 Documentation finalisation

- ADR status → Accepted
- `docs/operations/build-runtime-reference.md` — all env vars
- Mark this plan phases complete

**Phase 4 exit:** G6 — on-call can follow runbooks; alerts tested.

---

## File change summary (all phases)

| Path                                          | Phase |
| --------------------------------------------- | ----- |
| `src/instrumentation.ts`                      | 1, 3  |
| `src/lib/observability/http-propagators.ts`   | 1     |
| `src/lib/logger.ts`                           | 2     |
| `src/lib/ingestion-client.ts`                 | 1     |
| `src/lib/request-context.ts`                  | 1     |
| `src/components/GlobalErrorHandler.tsx`       | 1     |
| `ingestion/common/logging.py`                 | 1, 2  |
| `ingestion/common/log_sampling.py`            | 2     |
| `ingestion/common/telemetry.py`               | 3     |
| `ingestion/common/request_context.py`         | 1     |
| `ingestion/common/metrics.py`                 | 3     |
| `ingestion/api/app.py`                        | 1, 3  |
| `ingestion/api/job_queue.py`                  | 1     |
| `docker-compose.yml`                          | 2     |
| `.env.docker.example`                         | 2     |
| `package.json` / `ingestion/requirements.txt` | 1, 3  |

---

## Rollback strategy

| Phase | Rollback                                                      |
| ----- | ------------------------------------------------------------- |
| 1     | Set `OBSERVABILITY_ENABLED=false`; remove Sentry DSN          |
| 2     | Stop agent container; re-enable full ApplicationLog if needed |
| 3     | Disable APM; `/metrics` mount optional — leave if harmless    |
| 4     | Disable monitors; docs remain                                 |

No database migrations required for observability (ApplicationLog schema
unchanged).

---

## Dependencies and ordering

```
Phase 0 (docs) → Phase 1 (correlation + errors) → Phase 2 (logs + agent)
                                                      ↓
                                              Phase 3 (metrics + OTel)
                                                      ↓
                                              Phase 4 (alerts + hardening)
```

Phase 2 and 3 MAY overlap if different owners; Phase 1 MUST complete before
claiming cross-service trace success.

---

## Verification commands (Docker)

```bash
# Health
docker exec mre-app wget -qO- http://localhost:3001/api/v1/health
docker exec mre-liverc-ingestion-service curl -sf http://localhost:8000/health

# Metrics (after Phase 3)
docker exec mre-liverc-ingestion-service curl -s http://localhost:8000/metrics | head

# Unit tests
docker exec mre-app npm test -- --testPathPattern=observability
docker exec mre-liverc-ingestion-service python -m pytest ingestion/tests/unit/test_request_context_middleware.py -q

# Integration
docker exec mre-liverc-ingestion-service python -m pytest ingestion/tests/integration/test_observability_correlation.py -q
```

---

**End of observability-platform-remediation-2026-06.md**
