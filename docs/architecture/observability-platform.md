---
created: 2026-06-07
creator: Jayson Brenton
lastModified: 2026-06-07
description: Normative observability platform architecture for MRE final release
purpose:
  Defines the target observability stack (OpenTelemetry instrumentation, SaaS
  backend, Docker deployment model, service boundaries, and migration from the
  current Alpha logging implementation). All observability implementation work
  MUST align with this document and ADR-20260607.
relatedFiles:
  - docs/adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md
  - docs/architecture/observability-log-schema.md
  - docs/architecture/observability-correlation-and-tracing.md
  - docs/architecture/observability-sampling-retention-and-privacy.md
  - docs/architecture/logging.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/operations/observability-guide.md
  - docs/implimentation_plans/observability-platform-remediation-2026-06.md
status: Normative — proposed with ADR-20260607
---

# Observability Platform Architecture

**Status:** Normative (proposed)  
**Scope:** All MRE runtimes — Next.js app, LiveRC ingestion service, telemetry
worker  
**ADR:** [ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)

---

## 1. Purpose

This document specifies the **target observability architecture** for My Race
Engineer (MRE) at final release. It answers:

- What gets logged, measured, and traced
- Where data is stored and for how long
- How services correlate a single user action across containers
- How Docker deployments connect to a third-party SaaS platform
- What remains in Postgres vs what moves to SaaS

Implementation status is tracked in
[observability-platform-remediation-2026-06.md](../implimentation_plans/observability-platform-remediation-2026-06.md).
Until phases are complete, sections marked **Target** describe required end
state, not necessarily current behaviour.

---

## 2. Design principles

1. **Facade at the application layer** — Application code calls `logger`,
   `requestLogger`, structlog, `performance-logger`, and `security-logger`; it
   does NOT call vendor SDKs directly except in dedicated bootstrap modules.

2. **Structured by default** — All production logs MUST be machine-parseable
   JSON (ingestion already complies; Next.js MUST migrate console format to JSON
   stdout in production).

3. **Correlation everywhere** — Every log line SHOULD include `trace_id`,
   `span_id`, and `request_id` when inside a request or job context.

4. **SaaS is the operational system of record** — Search, retention, alerting,
   and dashboards use the observability platform. Postgres tables are
   supplementary.

5. **Audit is separate** — `AuditLog` records intentional admin/domain actions;
   it is NOT a substitute for operational logs and MUST NOT be deleted when SaaS
   is enabled.

6. **Fail open for observability** — Telemetry export failures MUST NOT break
   user-facing requests or ingestion jobs.

7. **Env-gated** — Local development runs with `OBSERVABILITY_ENABLED=false` by
   default; only console and optional DB logging apply.

---

## 3. System context

### 3.1 Runtimes and service names

| Container                      | OTel `service.name` | Log `service` field                           | Role                                      |
| ------------------------------ | ------------------- | --------------------------------------------- | ----------------------------------------- |
| `mre-app`                      | `mre-app`           | `nextjs` (legacy DB field) / `mre-app` (JSON) | Next.js UI + API                          |
| `mre-liverc-ingestion-service` | `liverc-ingestion`  | `liverc-ingestion`                            | FastAPI ingestion API + queue             |
| `mre-telemetry-worker`         | `telemetry-worker`  | `telemetry-worker`                            | Background telemetry pipeline             |
| `mre-postgres`                 | N/A (infra)         | N/A                                           | Database — metrics via agent/integrations |
| `mre-clickhouse`               | N/A (infra)         | N/A                                           | Optional telemetry cache                  |

### 3.2 Data flow (target)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Docker Compose network                           │
│                                                                          │
│  ┌──────────────┐    traceparent /      ┌──────────────────────────┐  │
│  │   mre-app    │─── X-Request-ID ─────▶│ liverc-ingestion-service │  │
│  │ logger + OTel│                       │ structlog + OTel         │  │
│  └──────┬───────┘                       └────────────┬─────────────┘  │
│         │                                            │                 │
│         │ stdout JSON                                │ stdout JSON     │
│         ▼                                            ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Datadog Agent (or Grafana Alloy) — log collection + APM + metrics │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │ OTLP / agent upload                  │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ Observability SaaS backend    │
                    │ (Datadog recommended default) │
                    └──────────────────────────────┘

         mre-app ──warn/error──▶ ApplicationLog (Postgres, sampled)
         admin actions ────────▶ AuditLog (Postgres, full retention)
```

### 3.3 Platform options

**Default (recommended): Datadog**

| Signal               | Mechanism                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| Logs                 | Agent tailing container stdout; optional log pipeline for JSON parsing           |
| APM / traces         | `dd-trace` (Node), `ddtrace` (Python), W3C propagation                           |
| Metrics              | Agent Prometheus check scraping `/metrics`; custom metrics via DogStatsD or OTel |
| RUM / browser errors | `@datadog/browser-rum` + `@datadog/browser-logs` (or Datadog Error Tracking)     |
| Alerting             | Datadog monitors                                                                 |

**Alternative: Grafana Cloud + Sentry**

| Signal   | Mechanism                             |
| -------- | ------------------------------------- |
| Logs     | Grafana Alloy or Promtail → Loki      |
| Traces   | OTel SDK → Tempo                      |
| Metrics  | OTel SDK or Prometheus scrape → Mimir |
| Errors   | Sentry SDK (Next.js server + client)  |
| Alerting | Grafana Alerting                      |

Both options MUST use the **same log schema** and **W3C Trace Context** headers
defined in sibling architecture documents.

---

## 4. Current vs target state

### 4.1 Next.js application

| Area            | Current (`src/`)                                                   | Target                                                                    |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Server logging  | `src/lib/logger.ts` — formatted console + batched `ApplicationLog` | JSON stdout in production + OTel context injection + optional remote sink |
| Client logging  | `src/lib/client-logger.ts` — console only                          | RUM / Sentry for errors + session replay (optional)                       |
| Request context | `src/lib/request-context.ts` — `requestId`, Prisma query telemetry | + W3C `trace_id`/`span_id`; propagate to downstream fetches               |
| Performance     | `src/lib/performance-logger.ts`, `api-performance-wrapper.ts`      | Same facades; export duration histograms via OTel                         |
| Security events | `src/lib/security-logger.ts`                                       | Unchanged API; ensure SaaS receives warn-level events                     |
| Admin logs UI   | `src/core/admin/logs.ts`, `/admin/logs`                            | Reads slim `ApplicationLog`; link-out to SaaS for full search (optional)  |

### 4.2 Python services

| Area     | Current (`ingestion/`)                                         | Target                                                               |
| -------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Logging  | `ingestion/common/logging.py` — structlog JSON                 | + OTel trace context processor; align field names with schema doc    |
| Tracing  | `ingestion/common/tracing.py` — log-only spans                 | Migrate to OTel spans; keep log span events during transition        |
| Metrics  | `ingestion/common/metrics.py` — in-process Prometheus registry | Expose `GET /metrics` on FastAPI; reduce high-cardinality labels     |
| HTTP API | `ingestion/api/app.py`                                         | Middleware: extract/inject `traceparent`, bind structlog contextvars |

### 4.3 Cross-service gap (must fix in Phase 1)

Today, `src/lib/ingestion-client.ts` sends only `Content-Type` on POST requests.
**Target:** every call to `INGESTION_SERVICE_URL` MUST include:

```
traceparent: <W3C traceparent>
tracestate: <optional>
X-Request-ID: <uuid>
X-MRE-User-ID: <uuid or omitted>
```

Same requirement for `src/core/admin/ingestion.ts`,
`src/core/practice-days/ingest-practice-day.ts`, and any other direct `fetch` to
the ingestion service.

---

## 5. Signal specifications

### 5.1 Logs

- **Schema:** [observability-log-schema.md](./observability-log-schema.md)
- **Sampling / PII:**
  [observability-sampling-retention-and-privacy.md](./observability-sampling-retention-and-privacy.md)
- **Ingestion lifecycle events:**
  [liverc-ingestion/15-ingestion-observability.md](./liverc-ingestion/15-ingestion-observability.md)
  §1

### 5.2 Metrics

**Next.js (target)**

| Metric                              | Type      | Labels                           | Source                    |
| ----------------------------------- | --------- | -------------------------------- | ------------------------- |
| `http.server.request.duration`      | histogram | `method`, `route`, `status_code` | OTel HTTP instrumentation |
| `http.server.request.count`         | counter   | same                             | OTel                      |
| `db.client.operation.duration`      | histogram | `operation`, `model`             | Prisma OTel or custom     |
| `ingestion.client.request.duration` | histogram | `endpoint`, `status`             | `IngestionClient` wrapper |

**Ingestion (existing + target exposure)**

All counters/histograms in `ingestion/common/metrics.py` MUST be exposed via
`GET /metrics` on the ingestion FastAPI app. See §2 of
[15-ingestion-observability.md](./liverc-ingestion/15-ingestion-observability.md).

**Label cardinality rule:** MUST NOT use unbounded UUIDs (`event_id`, `race_id`,
`user_id`) as metric labels in SaaS-exported metrics. Use aggregated labels
(`result`, `stage`, `error_code`, `track_slug`) or logs/traces for per-entity
detail. Existing high-cardinality labels in `metrics.py` MUST be refactored in
Phase 3 (see implementation plan).

### 5.3 Traces

- **Propagation:**
  [observability-correlation-and-tracing.md](./observability-correlation-and-tracing.md)
- **Required spans (ingestion):** `event_ingestion`, `event_page_fetch`,
  `race_page_fetch`, `lap_extraction`, `db_persistence`
- **Required spans (API):** HTTP route span; child span for `IngestionClient`
  calls

### 5.4 Errors

| Source                       | Target handling                                                     |
| ---------------------------- | ------------------------------------------------------------------- |
| API unhandled exceptions     | `handleApiError` + logger.error + error tracking event              |
| `IngestionServiceError`      | requestLogger.error with `code`, `source`, `status`                 |
| Client `GlobalErrorHandler`  | Forward to RUM/Sentry with URL, release, user id (if authenticated) |
| Ingestion `ingestion_failed` | structlog error + increment `connector_errors_total`                |

---

## 6. Storage and retention

| Data                            | Store                                | Production retention (target)                     |
| ------------------------------- | ------------------------------------ | ------------------------------------------------- |
| Operational logs (all services) | SaaS log index                       | 15 days hot; 30 days total (configurable)         |
| Traces                          | SaaS APM                             | 15 days; 100% errors, 10% success (head sampling) |
| Metrics                         | SaaS / Mimir                         | 13 months (monthly rollups)                       |
| Admin audit trail               | Postgres `AuditLog`                  | 1 year minimum; legal/compliance TBD              |
| App log convenience copy        | Postgres `ApplicationLog`            | 7 days; warn+error only when SaaS enabled         |
| Ingestion debug artefacts       | Filesystem fixtures / object storage | 30 days; debug mode only                          |

Detailed sampling and PII rules:
[observability-sampling-retention-and-privacy.md](./observability-sampling-retention-and-privacy.md).

---

## 7. Environment variables

All variables below are **target**. Names MAY be adjusted during implementation
but MUST be documented in `docs/operations/build-runtime-reference.md` when
shipped.

### 7.1 Global

| Variable                      | Default (local dev)                  | Description                                        |
| ----------------------------- | ------------------------------------ | -------------------------------------------------- |
| `OBSERVABILITY_ENABLED`       | `false`                              | Master switch for SaaS export                      |
| `OTEL_SERVICE_NAME`           | per service                          | `mre-app`, `liverc-ingestion`, `telemetry-worker`  |
| `OTEL_RESOURCE_ATTRIBUTES`    | `deployment.environment=development` | `deployment.environment`, `service.version`        |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | empty                                | OTLP endpoint when using OTel Collector or Grafana |
| `LOG_LEVEL`                   | `INFO`                               | Shared log level (already used by ingestion)       |
| `MRE_RELEASE_VERSION`         | git sha or semver                    | Attached to all telemetry                          |

### 7.2 Next.js (`mre-app`)

| Variable                                                       | Description                                         |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `APPLICATION_LOG_PERSIST_LEVELS`                               | Comma list, e.g. `warn,error` when SaaS on          |
| `APPLICATION_LOG_PERSIST_ENABLED`                              | `true`/`false` — DB batch writer                    |
| `SENTRY_DSN`                                                   | If using Sentry (Grafana path or standalone errors) |
| `DD_API_KEY`, `DD_SITE`, `DD_ENV`, `DD_SERVICE`                | Datadog path                                        |
| `NEXT_PUBLIC_DD_APPLICATION_ID`, `NEXT_PUBLIC_DD_CLIENT_TOKEN` | Datadog RUM (browser)                               |

### 7.3 Ingestion / telemetry worker

| Variable                      | Description                                               |
| ----------------------------- | --------------------------------------------------------- |
| `INGESTION_LOG_SAMPLE_RATE`   | `0.0`–`1.0` for verbose per-race INFO logs in production  |
| `INGESTION_LOG_ALWAYS_EVENTS` | Comma list of event names never sampled (see privacy doc) |
| `METRICS_ENABLED`             | Expose `/metrics` when `true`                             |

### 7.4 Datadog Agent (Compose service)

| Variable               | Description                                 |
| ---------------------- | ------------------------------------------- |
| `DD_API_KEY`           | Required when agent enabled                 |
| `DD_SITE`              | e.g. `datadoghq.com`, `datadoghq.eu`        |
| `DD_APM_ENABLED`       | `true`                                      |
| `DD_LOGS_ENABLED`      | `true`                                      |
| `DD_CONTAINER_EXCLUDE` | Exclude `postgres`, `clickhouse` if desired |

---

## 8. Docker Compose integration (target)

Add an `observability-agent` service (Datadog Agent or Grafana Alloy). Example
shape for Datadog (illustrative — exact config in setup runbook):

```yaml
datadog-agent:
  image: gcr.io/datadoghq/agent:7
  container_name: mre-datadog-agent
  environment:
    DD_API_KEY: ${DD_API_KEY}
    DD_SITE: ${DD_SITE:-datadoghq.com}
    DD_APM_ENABLED: "true"
    DD_LOGS_ENABLED: "true"
    DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: "true"
    DD_AC_EXCLUDE: "name:datadog-agent"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /proc/:/host/proc/:ro
    - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
  networks:
    - mre-network
```

Application containers MUST label themselves for service mapping:

```yaml
labels:
  com.datadoghq.ad.logs: '[{"source":"nodejs","service":"mre-app"}]'
```

Python ingestion:

```yaml
labels:
  com.datadoghq.ad.logs: '[{"source":"python","service":"liverc-ingestion"}]'
```

---

## 9. Admin and operator surfaces

| Surface               | Purpose                                   | Data source             |
| --------------------- | ----------------------------------------- | ----------------------- |
| `/admin/logs`         | Quick in-app tail for admins              | `ApplicationLog` (slim) |
| `/admin/audit`        | Compliance / who did what                 | `AuditLog`              |
| SaaS UI               | Primary investigation, alerts, dashboards | Agent + SDK             |
| `docker compose logs` | Local dev fallback                        | stdout                  |

**Target:** Admin logs page SHOULD display a banner linking to the SaaS log
explorer with pre-filled `service:mre-app` query when
`OBSERVABILITY_ENABLED=true`.

---

## 10. Migration phases (summary)

Full detail:
[observability-platform-remediation-2026-06.md](../implimentation_plans/observability-platform-remediation-2026-06.md).

| Phase | Focus                                | Delivers                                        |
| ----- | ------------------------------------ | ----------------------------------------------- |
| 0     | Schema + ADR + docs                  | Contract all code must follow                   |
| 1     | Correlation headers + error tracking | Cross-service IDs; Sentry/RUM or Datadog errors |
| 2     | Log platform + sampling              | Agent shipping; reduce DB log volume            |
| 3     | Metrics + OTel traces                | `/metrics`, span propagation, dashboards        |
| 4     | Production hardening                 | Alerts, runbooks, label cardinality fixes       |

Each phase MUST be deployable independently with observability disabled in dev.

---

## 11. Testing requirements

1. **Unit:** Log schema validation helpers; header injection in
   `IngestionClient`
2. **Integration:** Single API call → ingestion receives `traceparent` and logs
   matching `trace_id`
3. **Integration:** `/metrics` returns 200 and includes
   `ingestion_duration_seconds`
4. **Manual:** Trigger error in UI → appears in SaaS within 5 minutes (staging)

See `ingestion/tests/` and `src/__tests__/` additions in the implementation
plan.

---

## 12. Related documentation

- [Logging Architecture](./logging.md) — Next.js logger usage (updated for
  target state)
- [Monitoring and Observability Guide](../operations/observability-guide.md)
- [Observability Platform Setup Runbook](../operations/observability-platform-setup-runbook.md)
- [Observability Alerting Runbook](../operations/observability-alerting-runbook.md)
- [Ingestion Observability](./liverc-ingestion/15-ingestion-observability.md)

---

**End of observability-platform.md**
