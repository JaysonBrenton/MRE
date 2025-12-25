---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Observability model for LiveRC ingestion subsystem monitoring
purpose: Specifies the full observability model including logging, metrics, tracing,
         and alerting for the LiveRC ingestion subsystem. Ensures predictability,
         debuggability, and long-term operational stability.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md
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

---

## 1. Structured Logging

Ingestion MUST use structured, machine-parseable JSON logs.  
No plain text logging is permitted in production ingestion.

### 1.1 Log Shape

Each ingestion log entry MUST include:

- timestamp (UTC)
- subsystem: "liverc_ingestion"
- event_id (or null)
- track_id (or null)
- ingestion_stage (fetch_event_page, parse_event, fetch_race_page, parse_laps, persist_race, etc)
- severity (info, warn, error)
- message (short reason)
- details (object containing diagnostic values)

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
- metric: `db_rows_inserted`  
- labels: table_name  

- metric: `db_rows_updated`  
- labels: table_name  

#### 2.1.5 Connector Error Metrics  
- metric: `connector_errors_total`  
- labels: stage, error_code  

### 2.2 Metric Obligations

Metrics MUST be:

- emitted regardless of success or failure  
- deterministic in naming  
- stable across ingestion runs  

Metrics MAY be aggregated or exported to:

- Prometheus  
- OpenTelemetry Metrics  
- or simple in-process counters for V1  

---

## 3. Tracing (Cause-Effect Observability)

Distributed tracing is optional but recommended.

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

### Level 2 (Recommended Soon)

- Grafana dashboards for ingestion performance  
- connector error heatmaps  
- ingestion trace timelines  
- per-race latency histograms  

### Level 3 (Future)

- automatic anomaly detection:  
  - ingestion slower than baseline  
  - lap count deviations  
  - driver count mismatches  
  - LiveRC upstream changes  

- automatic opening of GitHub issues for ingestion regressions  
- machine learning-based ingestion drift detection  

---

## 9. Observability Guarantees

The ingestion subsystem MUST guarantee:

1. Every ingestion is fully observable.  
2. Any failure is diagnosable using logged, captured, and stored artefacts.  
3. Every race and lap has measurable ingestion latency.  
4. DB writes and connector fetches are visible in logs and metrics.  
5. Observability never compromises user privacy or driver identities.  

---

End of 15-ingestion-observability.md.
