---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-06-07
description: Observability model for LiveRC ingestion subsystem monitoring
purpose:
  Specifies the full observability model including logging, metrics, tracing,
  and alerting for the LiveRC ingestion subsystem. Ensures predictability,
  debuggability, and long-term operational stability.
relatedFiles:
  - docs/adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md
  - docs/architecture/observability-platform.md
  - docs/architecture/observability-log-schema.md
  - docs/architecture/observability-correlation-and-tracing.md
  - docs/architecture/observability-sampling-retention-and-privacy.md
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md
  - docs/operations/observability-alerting-runbook.md
  - docs/roles/observability-incident-response-lead.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 15. Ingestion Observability (LiveRC Ingestion Subsystem)

This document specifies the full observability model for the LiveRC ingestion
subsystem in My Race Engineer (MRE). Observability is mandatory for ensuring
predictability, debuggability, and long-term operational stability. Since
ingestion is admin-triggered, occasionally browser-driven, and integrates with a
third-party website (LiveRC), the system must expose clear signals about what is
happening, why it is happening, and where failures occur.

The goals of ingestion observability are:

- correctness: detect ingestion drift or mismatched upstream data
- performance insight: measure ingestion latency and bottlenecks
- stability: detect intermittent failures, parser issues, or browser instability
- debugging: enable developers to diagnose failures without accessing prod data
- reproducibility: ensure ingestion produces deterministic outcomes

Observability covers four pillars:

1. Structured logging
2. Metrics
3. Tracing
4. Artefacts and diagnostics (fixtures, snapshots, error dumps)

**Platform-wide observability (SaaS, OTel, correlation):** See
[observability-platform.md](../observability-platform.md) and
[ADR-20260607](../../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md).
Canonical JSON field names:
[observability-log-schema.md](../observability-log-schema.md). Production
sampling:
[observability-sampling-retention-and-privacy.md](../observability-sampling-retention-and-privacy.md).

---

## 1. Structured Logging

Ingestion MUST use structured, machine-parseable JSON logs.  
No plain text logging is permitted in production ingestion.

Implementation: `ingestion/common/logging.py` (structlog).

### 1.1 Log Shape

Each ingestion log entry MUST conform to
[observability-log-schema.md](../observability-log-schema.md). Minimum ingestion
fields:

- `timestamp` (UTC ISO 8601)
- `level` (`info`, `warn`, `error`)
- `message` (stable event name — see §1.2)
- `service`: `liverc-ingestion` or `telemetry-worker`
- `ingestion.subsystem`: `liverc_ingestion`
- `ingestion.event_id` (or null)
- `ingestion.track_id` (or null)
- `ingestion.stage` (see schema doc enum)
- `request_id`, `trace_id`, `span_id` when in HTTP or job context (target —
  Phase 1)
- `error.code`, `error.message`, `error.stack` on failures

Legacy structlog keys (`event_id`, `ingestion_stage`) MUST be normalised to
schema names during observability Phase 2.

### 1.2 Lifecycle Events

Minimum required lifecycle log messages:

- ingestion_start
- ingestion_finish
- ingestion_skip_already_complete
- event_page_fetched
- race_page_fetched
- laps_extracted
- db_upsert_summary
- ingestion_failed

### 1.3 Error Logging

All errors MUST:

- set severity = "error"
- include a stable error code
- include a stack trace when available
- include connector-level metadata (page URL, HTTP status, race identifiers)

Errors that do NOT break ingestion may be logged as severity = "warn" but MUST
still include full diagnostic details.

---

## 2. Metrics (Quantitative Observability)

Metrics MUST be emitted from ingestion in a consistent, connector-agnostic way.

### 2.1 Core Metric Families

#### 2.1.1 Ingestion Duration

- metric: `ingestion_duration_seconds`
- labels: event_id, track_id, result = success|error

#### 2.1.2 Race Page Fetch Duration

- metric: `race_fetch_duration_seconds`
- labels: event_id, race_id, method = httpx|playwright

#### 2.1.3 Lap Extraction Duration

- metric: `lap_extraction_duration_seconds`
- labels: event_id, race_id

#### 2.1.4 DB Write Metrics

- metric: `db_rows_inserted_total`
- labels: table_name

- metric: `db_rows_updated_total`
- labels: table_name

#### 2.1.5 Connector Error Metrics

- metric: `connector_errors_total`
- labels: stage, error_code

#### 2.1.6 Practice day full ingestion

- metric: `practice_day_ingestion_duration_seconds` — labels: track_slug, date,
  result
- metric: `practice_day_ingestion_requests_total` — labels: track_slug, result
- metric: `practice_day_sessions_ingested_total` — labels: track_slug
- metric: `practice_day_sessions_with_laps_total` — sessions for which at least
  one lap was written
- metric: `practice_day_laps_ingested_total` — total laps ingested
- metric: `practice_day_sessions_detail_failed_total` — sessions whose detail
  fetch failed

Log events: `ingest_practice_day_start`, `ingest_practice_day_success` (with
sessions_ingested, sessions_with_laps, laps_ingested, sessions_detail_failed),
`practice_session_detail_fetch_failed` (session_id, error).

### 2.2 Metric Obligations

Metrics MUST be:

- emitted regardless of success or failure
- deterministic in naming
- stable across ingestion runs

Metrics are recorded in-process via `ingestion/common/metrics.py` (Prometheus
client). **Target:** expose `GET /metrics` on the FastAPI app and scrape via the
observability agent (Datadog OpenMetrics or Grafana Alloy). High-cardinality
labels (`event_id`, `race_id`) MUST be removed from exported metric labels per
[observability-sampling-retention-and-privacy.md](../observability-sampling-retention-and-privacy.md).

Metrics MAY be aggregated or exported to:

- Prometheus (via `/metrics` — target Phase 3)
- OpenTelemetry Metrics
- Datadog / Grafana Cloud via agent scrape

---

## 3. Tracing (Cause-Effect Observability)

**Current:** Log-based spans in `ingestion/common/tracing.py`
(`trace_span_start`, `trace_span_end`).

**Target (required for final release):** OpenTelemetry spans with W3C Trace
Context propagation from `mre-app`. Spec:
[observability-correlation-and-tracing.md](../observability-correlation-and-tracing.md).

If tracing is enabled:

### 3.1 Span Requirements

Each ingestion MUST generate spans for:

- event_ingestion
- event_page_fetch
- race_page_fetch
- lap_extraction
- db_persistence

Each span MUST include:

- start + end timestamps
- success/failure status
- relevant IDs (event_id, race_id, driver_id)
- connector type: httpx or playwright

### 3.2 Trace Context Propagation

When ingestion triggers nested operations (e.g., race fetches), parent/child
spans MUST be linked.

Even without external tracing systems, the ingestion can store trace_context in
logs for debugging.

---

## 4. Artefacts and Diagnostic Data

Observability also includes preserving artefacts useful for debugging ingestion
errors.

### 4.1 HTML Snapshots (Fixtures)

When ingestion fails or under debug mode, the system SHOULD store snapshots:

- raw event page HTML
- raw race page HTML
- raw lap popup HTML (if applicable)

Rules:

- store in a local fixtures directory or object storage
- redact user data if required
- include metadata: timestamp, URL, event_id, race_id

### 4.2 Playwright Screenshots (Optional)

For JS-related issues (e.g., buttons not rendering), on failure the system MAY
capture:

- screenshot before selector lookup
- screenshot after click attempts

Captured only under:

- debug mode, or
- ingestion failure conditions

### 4.3 Normalisation Debug Dumps

The normalisation layer SHOULD be able to emit intermediate representations:

- parsed race summary
- parsed results table
- parsed laps
- normalised lap rows before DB persistence

These dumps MUST be disabled in production unless debugging is explicitly
enabled.

---

## 5. Status Surfaces (How the System Exposes State)

Users (admins) need to know what ingestion is doing.

Ingestion state MUST be exposed via:

### 5.1 Database State Columns

- `ingest_depth` (none, laps_full)
- `last_ingested_at`
- optionally `ingestion_status` (idle, running, failed)

These are shown in API endpoints:

- GET /events/{event_id}
- GET /tracks

### 5.2 Admin Console Indicators (Future)

Admin UI MUST display:

- ingestion start time
- ingestion end time
- races processed
- failures encountered
- logs and metrics (or links to them)

### 5.3 CLI Output (V1)

CLI ingestion SHOULD print:

- progress (race X of Y)
- timing summary
- error summary

---

## 6. Failure Classification and Observability Guarantees

Failures MUST be classified into:

### 6.1 Connector Failures

- HTTPX fetch errors
- Playwright timeouts
- missing DOM nodes
- parsing inconsistencies

### 6.2 Normaliser Failures

- unexpected HTML structures
- missing numeric fields
- format conversion errors

### 6.3 Database Failures

- constraint violations
- connection pool exhaustion
- serialization or locking issues

### 6.4 System-Level Failures

- OOM
- CPU timeouts
- file system full

Each failure MUST:

- be logged with code + stage
- produce a clear error message
- be surfaced to the admin API
- increment metrics counters

Ingestion MUST NOT silently ignore any failure class.

---

## 7. Observability in Local Development

Local development MUST support:

- verbose logging
- Playwright debug mode with devtools
- HTML extraction snapshots
- fixture-based ingestion (no network)

Fixtures MUST be stored in:

`fixtures/liverc/<event_id>/…`

This ensures reproducible debugging, even offline.

---

## 8. Observability Maturity Model

MRE ingestion aims for the following levels:

### Level 1 (Minimum, V1)

- structured logs
- ingestion duration metrics
- lap extraction metrics
- clear error logs
- ingestion status fields

### Level 2 (Recommended Soon — observability platform Phase 2–3)

- SaaS dashboards for ingestion performance (Datadog or Grafana Cloud)
- connector error heatmaps
- ingestion trace timelines (OTel APM)
- per-race latency in traces/logs (not high-cardinality metric labels)

### Level 3 (Future)

- automatic anomaly detection:
  - ingestion slower than baseline
  - lap count deviations
  - driver count mismatches
  - LiveRC upstream changes

- automatic opening of GitHub issues for ingestion regressions
- machine learning-based ingestion drift detection

---

## 9. Scheduled auto-ingest observability

The [31-recent-events-auto-ingest.md](31-recent-events-auto-ingest.md) job is
implemented; operators must be able to answer “did last night’s job work?”
without SSH guesswork.

### 9.1 Structured log events

The `refresh-recent-events` CLI MUST emit structlog events including:

- `refresh_recent_events_start`
- `refresh_recent_events_track_start` / `_track_done`
- `refresh_recent_events_event_ingest` / `_event_skipped`
- `refresh_recent_events_complete` (with `totals`, `duration_ms`)

Cron stdout: `/var/log/recent-events-auto-ingest.log` in the ingestion
container.

### 9.2 Prometheus metrics

Implemented in `ingestion/common/metrics.py`:

| Metric                                                                       | Type      |
| ---------------------------------------------------------------------------- | --------- |
| `recent_events_auto_ingest_runs_total{status}` (`success`/`partial`/`empty`) | Counter   |
| `recent_events_auto_ingest_events_ingested_total`                            | Counter   |
| `recent_events_auto_ingest_events_failed_total`                              | Counter   |
| `recent_events_auto_ingest_duration_seconds`                                 | Histogram |

### 9.3 Recommended alerts

| Alert             | Condition                                            |
| ----------------- | ---------------------------------------------------- |
| Job missing       | No `refresh_recent_events_complete` in 26 h          |
| High failure rate | `events_failed / events_attempted > 0.5` over 3 runs |
| Long run          | `duration_ms > 7_200_000` (2 h)                      |

Runbook:
[recent-events-auto-ingest-runbook.md](../../operations/recent-events-auto-ingest-runbook.md).

---

## 10. Observability Guarantees

The ingestion subsystem MUST guarantee:

1. Every ingestion is fully observable.
2. Any failure is diagnosable using logged, captured, and stored artefacts.
3. Every race and lap has measurable ingestion latency.
4. DB writes and connector fetches are visible in logs and metrics.
5. Observability never compromises user privacy or driver identities.

---

End of 15-ingestion-observability.md.
