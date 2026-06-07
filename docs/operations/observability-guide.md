---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-06-07
description: Comprehensive observability guide for MRE application
purpose:
  Provides detailed guidance for logging, metrics, tracing, alerting, dashboard
  setup, troubleshooting, and performance monitoring. Ensures consistent
  observability practices and helps with troubleshooting and performance
  optimization.
relatedFiles:
  - docs/adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md
  - docs/architecture/observability-platform.md
  - docs/architecture/logging.md
  - docs/roles/observability-incident-response-lead.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/operations/observability-platform-setup-runbook.md
  - docs/operations/observability-alerting-runbook.md
  - docs/implimentation_plans/observability-platform-remediation-2026-06.md
---

# Monitoring and Observability Guide

**Last Updated:** 2026-06-07  
**Scope:** All observability aspects of the MRE application

This guide describes **current behaviour**, **target architecture** for final
release, and **operator procedures**. For step-by-step SaaS setup see the
[setup runbook](./observability-platform-setup-runbook.md). For alert
definitions see the [alerting runbook](./observability-alerting-runbook.md).

**Authoritative architecture:**
[observability-platform.md](../architecture/observability-platform.md)  
**ADR:** [ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)

---

## Table of Contents

1. [Executive summary](#1-executive-summary)
2. [Logging](#2-logging)
3. [Metrics](#3-metrics)
4. [Tracing](#4-tracing)
5. [Error tracking](#5-error-tracking)
6. [Alerting](#6-alerting)
7. [Dashboards](#7-dashboards)
8. [Troubleshooting](#8-troubleshooting)
9. [Performance monitoring](#9-performance-monitoring)
10. [Implementation status](#10-implementation-status)

---

## 1. Executive summary

MRE runs in Docker with three primary application containers:

| Container                      | Service name         | Observability today                                   |
| ------------------------------ | -------------------- | ----------------------------------------------------- |
| `mre-app`                      | `mre-app` / `nextjs` | Structured console + `ApplicationLog` DB              |
| `mre-liverc-ingestion-service` | `liverc-ingestion`   | structlog JSON stdout + in-process Prometheus metrics |
| `mre-telemetry-worker`         | `telemetry-worker`   | Same Python stack as ingestion                        |

**Target:** OpenTelemetry instrumentation exporting to a **third-party SaaS**
(Datadog recommended; Grafana Cloud + Sentry documented as alternative).
Postgres `AuditLog` always retained; `ApplicationLog` demoted to warn/error in
production.

**Local development:** `OBSERVABILITY_ENABLED=false` — no SaaS keys required.

---

## 2. Logging

### 2.1 Standards

- **Schema:**
  [observability-log-schema.md](../architecture/observability-log-schema.md)
- **PII / sampling:**
  [observability-sampling-retention-and-privacy.md](../architecture/observability-sampling-retention-and-privacy.md)
- **Next.js usage:** [logging.md](../architecture/logging.md)
- **Ingestion lifecycle events:**
  [15-ingestion-observability.md](../architecture/liverc-ingestion/15-ingestion-observability.md)
  §1

### 2.2 Next.js application (current)

**Implemented:**

- `src/lib/logger.ts` — levels DEBUG/INFO/WARN/ERROR
- Request context via `createRequestLogger()` — `requestId`, Prisma query
  telemetry
- `src/lib/client-logger.ts` — browser-safe API
- Batched persistence to `ApplicationLog` (all levels in dev; target warn+error
  in prod SaaS)
- Admin viewer at `/admin/logs`

**Not yet implemented (Phase 1–2):**

- JSON stdout in production
- W3C trace context in logs
- Propagation of `X-Request-ID` to ingestion service
- SaaS log shipping

### 2.3 Python ingestion and telemetry worker (current)

**Implemented:**

- structlog JSON via `ingestion/common/logging.py`
- `LOG_LEVEL` environment variable
- Log-based spans in `ingestion/common/tracing.py`

**Not yet implemented:**

- OTel trace context in structlog
- Log sampling processor (production)
- FastAPI middleware for incoming trace headers

### 2.4 Correlation

| ID                     | Status             | Spec                                                                        |
| ---------------------- | ------------------ | --------------------------------------------------------------------------- |
| `request_id`           | Partial — API only | [correlation doc](../architecture/observability-correlation-and-tracing.md) |
| `trace_id` / `span_id` | Not cross-service  | Same                                                                        |

### 2.5 Where logs live

| Store            | Role               | Retention (target)          |
| ---------------- | ------------------ | --------------------------- |
| SaaS log index   | Primary operations | 30 days                     |
| `ApplicationLog` | Admin convenience  | 30 days; warn+error in prod |
| `AuditLog`       | Admin audit trail  | 1+ years                    |
| Docker stdout    | Collection source  | Ephemeral until shipped     |

---

## 3. Metrics

### 3.1 Next.js (current)

- Slow request warnings via `performance-logger.ts` and
  `api-performance-wrapper.ts`
- Thresholds: `PERF_THRESHOLD_API`, `PERF_THRESHOLD_DB`,
  `PERF_THRESHOLD_EXTERNAL`
- Prisma query count on request INFO logs

**Target:** OTel HTTP server metrics exported to SaaS.

### 3.2 Ingestion (current)

Prometheus metrics defined in `ingestion/common/metrics.py` on dedicated
`REGISTRY`. Key families:

| Metric                                             | Type      | Notes                |
| -------------------------------------------------- | --------- | -------------------- |
| `ingestion_duration_seconds`                       | Histogram | Per-event timing     |
| `race_fetch_duration_seconds`                      | Histogram | HTTPX vs Playwright  |
| `lap_extraction_duration_seconds`                  | Histogram | Parser timing        |
| `db_rows_inserted_total` / `db_rows_updated_total` | Counter   | By table             |
| `connector_errors_total`                           | Counter   | By stage, error_code |
| `ingestion_lock_timeouts_total`                    | Counter   | Lock contention      |
| `site_policy_events_total`                         | Counter   | Throttling           |
| Practice day + recent events auto-ingest families  | Various   | See metrics.py       |
| `telemetry_jobs_total`                             | Counter   | Telemetry worker     |

**Gap:** No HTTP **`GET /metrics`** endpoint yet — metrics are in-process only.

**Target (Phase 3):** Mount Prometheus ASGI app; scrape via Datadog agent or
Alloy. Refactor high-cardinality labels (`event_id`, `race_id`) per privacy doc.

### 3.3 Infrastructure

**Target:** Container CPU, memory, network via Datadog agent or cAdvisor →
Grafana.

---

## 4. Tracing

### 4.1 Current

- **Ingestion:** Log-only `TraceSpan` in `ingestion/common/tracing.py` emits
  `trace_span_start` / `trace_span_end` JSON events
- **Next.js:** No distributed tracing

### 4.2 Target

OpenTelemetry spans with W3C `traceparent` propagation:

```
Browser → mre-app HTTP span → IngestionClient span → ingestion HTTP span → pipeline spans
```

Required ingestion spans: `event_ingestion`, `event_page_fetch`,
`race_page_fetch`, `lap_extraction`, `db_persistence`.

Sampling: 100% errors; 10% successful API traces; 25% successful ingestion
(configurable).

Spec:
[observability-correlation-and-tracing.md](../architecture/observability-correlation-and-tracing.md)

---

## 5. Error tracking

### 5.1 Current

- Server: `logger.error()` + console + ApplicationLog
- Client: `GlobalErrorHandler` + `clientLogger`
- TODO in `logger.ts` for SaaS integration

### 5.2 Target (Phase 1)

| Path                | Tool                         |
| ------------------- | ---------------------------- |
| Datadog default     | Datadog Error Tracking + RUM |
| Grafana alternative | Sentry (`@sentry/nextjs`)    |

Gated by `OBSERVABILITY_ENABLED=true`.

---

## 6. Alerting

Monitor definitions, severities, and response steps:
[observability-alerting-runbook.md](./observability-alerting-runbook.md)

Summary:

| Severity | Examples                                                         |
| -------- | ---------------------------------------------------------------- |
| P1       | App/ingestion health down, API error rate >5%                    |
| P2       | Ingestion failure spike, advisory lock leak, auto-ingest missing |
| P3       | Elevated p95 latency, container memory high                      |

**Status:** Monitors to be created in SaaS after Phase 3 metrics/traces ship.

---

## 7. Dashboards

### 7.1 Recommended dashboards (create in SaaS)

1. **MRE API** — request rate, p95 latency, error rate by route
2. **LiveRC ingestion** — ingest success/fail, duration p95, connector errors,
   lock timeouts
3. **Infrastructure** — per-container CPU/memory
4. **Telemetry worker** — `telemetry_jobs_total` by outcome

### 7.2 In-app surfaces

| UI              | Data                    |
| --------------- | ----------------------- |
| `/admin/logs`   | `ApplicationLog` (slim) |
| `/admin/audit`  | `AuditLog`              |
| `/admin/health` | Service health checks   |

**Target:** Link from admin logs to SaaS explorer with pre-filled query.

---

## 8. Troubleshooting

### 8.1 Workflow

1. **Identify** — alert, user report, or admin UI
2. **Correlate** — obtain `request_id` from API response header or admin logs
3. **Search SaaS** — `request_id:` or `trace_id:` across services
4. **Fallback** — `docker compose logs app liverc-ingestion-service`
5. **Mitigate** — runbooks for locks, ingestion, deployment
6. **Document** — post-incident update

### 8.2 Common issues

| Symptom                     | First checks                                                                      |
| --------------------------- | --------------------------------------------------------------------------------- |
| High API error rate         | SaaS: group by `@http.route`; recent deploy                                       |
| Slow API                    | APM flame graph; `prismaQueryCount` in logs                                       |
| Ingestion failed            | `@message:ingestion_failed`, `@error.code`, `@ingestion.stage`                    |
| INGESTION_IN_PROGRESS stuck | [ingestion-lock-recovery-runbook.md](./ingestion-lock-recovery-runbook.md)        |
| No logs in SaaS             | [setup runbook §10](./observability-platform-setup-runbook.md#10-troubleshooting) |

### 8.3 Useful Docker commands

```bash
docker logs mre-app --tail 200
docker logs mre-liverc-ingestion-service --tail 200
docker exec mre-app wget -qO- http://localhost:3001/api/v1/health
docker exec mre-liverc-ingestion-service curl -sf http://localhost:8000/health
# After Phase 3:
docker exec mre-liverc-ingestion-service curl -s http://localhost:8000/metrics | head
```

---

## 9. Performance monitoring

### 9.1 KPIs (final release SLOs)

| SLI                    | Target                  |
| ---------------------- | ----------------------- |
| API availability       | 99.5% / 30d             |
| API p95 latency        | <1s                     |
| Ingestion success rate | 95% (excl. user-caused) |
| Time to detect P1      | <5 min                  |

### 9.2 Baselines (engineering targets)

| Metric              | Target                            |
| ------------------- | --------------------------------- |
| API p95             | <1s                               |
| Error rate          | <0.1% steady state                |
| DB query p95        | <200ms                            |
| Ingestion event p95 | Environment-specific; alert >600s |

### 9.3 Tools

| Signal  | Current               | Target                |
| ------- | --------------------- | --------------------- |
| Logs    | Console, DB, Docker   | SaaS                  |
| Metrics | In-process Prometheus | Scraped / OTel        |
| Traces  | Log spans (ingestion) | OTel APM              |
| RUM     | None                  | Datadog RUM or Sentry |

---

## 10. Implementation status

Tracked in
[observability-platform-remediation-2026-06.md](../implimentation_plans/observability-platform-remediation-2026-06.md):

| Phase | Focus                        | Status          |
| ----- | ---------------------------- | --------------- |
| 0     | Documentation + ADR          | **In progress** |
| 1     | Correlation + error tracking | Planned         |
| 2     | Log platform + sampling      | Planned         |
| 3     | Metrics + OTel traces        | Planned         |
| 4     | Alerts + hardening           | Planned         |

---

## Related documentation

- [Observability Platform Architecture](../architecture/observability-platform.md)
- [Logging Architecture](../architecture/logging.md)
- [Observability Platform Setup Runbook](./observability-platform-setup-runbook.md)
- [Observability Alerting Runbook](./observability-alerting-runbook.md)
- [Observability & Incident Response Lead Role](../roles/observability-incident-response-lead.md)
- [Ingestion Observability](../architecture/liverc-ingestion/15-ingestion-observability.md)
- [Performance Requirements](../architecture/performance-requirements.md)

---

**End of Observability Guide**
