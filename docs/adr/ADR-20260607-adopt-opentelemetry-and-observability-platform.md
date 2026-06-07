---
created: 2026-06-07
status: Proposed
deciders: Engineering, Platform, Observability
---

# ADR-20260607 — Adopt OpenTelemetry instrumentation and a third-party observability platform

## Context

MRE runs as multiple Docker containers (`mre-app`,
`mre-liverc-ingestion-service`, `mre-telemetry-worker`, `mre-postgres`, optional
`mre-clickhouse`). Observability today is **partially implemented** but **not
production-grade**:

| Capability                | Next.js (`mre-app`)                                                                      | Python ingestion / telemetry worker                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Structured logging        | Custom logger in `src/lib/logger.ts`; console + batched `ApplicationLog` DB writes       | structlog JSON to stdout via `ingestion/common/logging.py`                           |
| Correlation IDs           | `requestId` in API routes; `X-Request-ID` response header in `withPerformanceLogging`    | Log-based `TraceSpan` in `ingestion/common/tracing.py` only                          |
| Cross-service propagation | **Not implemented** — `IngestionClient` does not forward correlation headers             | N/A                                                                                  |
| Metrics                   | Performance thresholds in `performance-logger.ts`; Prisma query counts in request logger | Prometheus metrics in `ingestion/common/metrics.py`; **no `/metrics` HTTP endpoint** |
| Error tracking (SaaS)     | TODO comment in `logger.ts`; client errors via `client-logger.ts` only                   | structlog error events only                                                          |
| Admin visibility          | `/admin/logs` reads `ApplicationLog`; `/admin/audit` reads `AuditLog`                    | Docker stdout only                                                                   |
| Alerting / dashboards     | Documented as placeholders in `docs/operations/observability-guide.md`                   | Same                                                                                 |

Operational pain expected at final release:

- Debugging a user-triggered ingest requires correlating API logs, ingestion
  stdout, and DB state manually.
- Ingestion log volume will make Postgres `ApplicationLog` persistence expensive
  and slow if used as the primary log store.
- No unified alerting when ingestion fails, API error rate spikes, or lock leaks
  occur.
- No client-side error grouping for React/global errors in production.

The project is moving toward **final release**. Stakeholders have indicated
preference for a **third-party SaaS observability platform** (logs, metrics,
traces, errors) rather than building and operating a full stack in-house.

Constraints:

- **Docker-only runtime** per `docs/AGENTS.md` — all collectors/agents must work
  in Compose and future production orchestration.
- **Audit trail** for admin actions must remain in Postgres (`AuditLog`) for
  compliance and in-app review regardless of SaaS choice.
- **PII / scraping boundaries** — logs must not contain passwords, tokens, raw
  LiveRC HTML at INFO+, or unsanitized email addresses (see
  `docs/architecture/observability-sampling-retention-and-privacy.md`).
- **Alpha / v0.1.1 scope** — observability work must be phased;
  `OBSERVABILITY_ENABLED` (or equivalent) must allow local dev without SaaS
  credentials.

## Decision

1. **Instrumentation standard:** Adopt **OpenTelemetry (OTel)** as the
   cross-runtime instrumentation layer for **traces** and **metrics export**.
   Application code continues to use existing facades (`src/lib/logger.ts`,
   structlog) but MUST inject OTel trace/span context into every log line and
   support W3C Trace Context propagation on internal HTTP calls.

2. **Primary observability platform (recommended for final release):**
   **Datadog** as the default single-vendor backend for logs, metrics, traces,
   APM, and RUM — deployed via the Datadog Agent in Docker (log collection from
   container stdout + APM libraries for Node.js and Python).

3. **Documented alternative:** **Grafana Cloud** (Loki + Mimir + Tempo) with
   **Sentry** for error grouping MAY be used instead when cost or vendor
   neutrality is prioritized. OTel export MUST remain the same; only the
   exporter/backend changes.

4. **Log storage strategy:**
   - **Primary system of record for operational logs:** SaaS log index (via
     stdout shipping and/or OTel log export).
   - **`AuditLog`:** Always Postgres; never replaced by SaaS.
   - **`ApplicationLog`:** Retained for admin convenience in production but
     **demoted** — persist only `warn` and `error` (configurable); disable
     `info`/`debug` DB writes when SaaS is enabled. Full volume MUST NOT be
     written to Postgres in production.

5. **Ingestion log sampling:** Production ingestion MUST sample verbose
   per-race/per-lap INFO logs per
   `docs/architecture/observability-sampling-retention-and-privacy.md`.
   Lifecycle and error events MUST always be logged at full rate.

6. **Normative specifications** (implementation MUST follow):
   - [observability-platform.md](../architecture/observability-platform.md)
   - [observability-log-schema.md](../architecture/observability-log-schema.md)
   - [observability-correlation-and-tracing.md](../architecture/observability-correlation-and-tracing.md)
   - [observability-sampling-retention-and-privacy.md](../architecture/observability-sampling-retention-and-privacy.md)

7. **Implementation plan:**
   [observability-platform-remediation-2026-06.md](../implimentation_plans/observability-platform-remediation-2026-06.md)

8. **Operations runbooks:**
   - [observability-platform-setup-runbook.md](../operations/observability-platform-setup-runbook.md)
   - [observability-alerting-runbook.md](../operations/observability-alerting-runbook.md)

## Consequences

**Positive**

- Single pane (or coordinated panes) for logs, metrics, traces, and errors at
  final release.
- Cross-service debugging: API request → ingestion job → pipeline stage via
  shared `trace_id` / `request_id`.
- Alerting and dashboards without building Grafana/Prometheus infrastructure
  in-house (Datadog path).
- Existing call sites largely unchanged — sinks and middleware added at
  boundaries.
- OTel choice avoids re-instrumentation when switching SaaS backends.

**Negative / trade-offs**

- SaaS cost scales with log volume; ingestion sampling policy is mandatory.
- Datadog Agent adds a container and configuration surface in Compose.
- Dual logging during migration (console + SaaS + slim DB) until Phase 4.
- Engineers must learn platform UI, alert tuning, and sampling rules.
- `docs/operations/observability-guide.md` and related docs require ongoing sync
  with shipped env vars and dashboards.

**Risks**

- High-cardinality metric labels (e.g. per-`event_id` histograms) may inflate
  SaaS cost — existing `metrics.py` labels MUST be reviewed in Phase 3.
- Client-side bundle size if RUM/Sentry SDKs are added carelessly — use lazy
  init and env gating.
- Local dev without SaaS keys must remain usable
  (`OBSERVABILITY_ENABLED=false`).

## Alternatives considered

| Alternative                                                     | Rejected because                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Postgres `ApplicationLog` as primary log store for all services | Wrong store for ingestion volume; no alerting/search at scale; DB write load                   |
| Build self-hosted ELK/Loki stack only                           | Operational burden for small team; delays final-release readiness                              |
| Sentry-only                                                     | No unified ingestion log search, infra metrics, or cross-service traces at required depth      |
| Replace custom logger + structlog with one shared library       | Impossible across TypeScript and Python; OTel + schema contract is the correct abstraction     |
| Datadog without OTel (vendor SDK only)                          | Locks instrumentation to one vendor; OTel is industry standard and already referenced in docs  |
| No SaaS; Docker logs only                                       | Insufficient for final release ops, alerting, and client error grouping                        |
| Big-bang migration before correlation headers                   | Cross-service value of SaaS is low until `traceparent` / `X-Request-ID` propagate to ingestion |

## Status notes

This ADR is **Proposed** until Platform and Observability leads accept the
platform choice (Datadog vs Grafana Cloud + Sentry) for the target deployment
environment. Implementation phases MAY begin with Phase 0–1 (schema,
correlation, error tracking) before the final vendor contract is signed.
