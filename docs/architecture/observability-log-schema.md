---
created: 2026-06-07
creator: Jayson Brenton
lastModified: 2026-06-07
description: Canonical log schema contract for all MRE runtimes
purpose:
  Defines required and optional fields for every structured log line emitted by
  mre-app, liverc-ingestion, and telemetry-worker. SaaS parsers, OTel exporters,
  and ApplicationLog persistence MUST map to this schema. Field names use
  snake_case in JSON output for cross-runtime consistency.
relatedFiles:
  - docs/architecture/observability-platform.md
  - docs/architecture/observability-correlation-and-tracing.md
  - docs/architecture/observability-sampling-retention-and-privacy.md
  - docs/architecture/logging.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - src/lib/logger.ts
  - ingestion/common/logging.py
status: Normative — proposed with ADR-20260607
---

# Observability Log Schema Contract

**Status:** Normative (proposed)  
**ADR:** [ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)

All MRE services MUST emit logs that conform to this contract in **production**.
Development MAY use human-readable console prefixes during migration, but JSON
field names MUST match when `OBSERVABILITY_ENABLED=true` or
`NODE_ENV=production`.

---

## 1. Envelope (required on every log line)

| Field       | Type                  | Required | Description                                                       |
| ----------- | --------------------- | -------- | ----------------------------------------------------------------- |
| `timestamp` | string (ISO 8601 UTC) | **Yes**  | Event time, e.g. `2026-06-07T12:34:56.789Z`                       |
| `level`     | string                | **Yes**  | One of: `debug`, `info`, `warn`, `error` (lowercase)              |
| `message`   | string                | **Yes**  | Stable, grep-friendly event name or short description             |
| `service`   | string                | **Yes**  | `mre-app`, `liverc-ingestion`, `telemetry-worker`                 |
| `env`       | string                | **Yes**  | `development`, `staging`, `production`                            |
| `version`   | string                | **Yes**  | Release identifier (git SHA or semver from `MRE_RELEASE_VERSION`) |

### 1.1 Example envelope (minimal)

```json
{
  "timestamp": "2026-06-07T02:15:00.123Z",
  "level": "info",
  "message": "request_completed",
  "service": "mre-app",
  "env": "production",
  "version": "abc1234"
}
```

---

## 2. Correlation fields (required when in a request or job)

| Field            | Type            | Required when                           | Description                             |
| ---------------- | --------------- | --------------------------------------- | --------------------------------------- |
| `trace_id`       | string (32 hex) | HTTP request, ingestion job, traced CLI | W3C trace id                            |
| `span_id`        | string (16 hex) | Same                                    | Current span id                         |
| `request_id`     | string (UUID)   | HTTP request initiated by mre-app       | MRE-specific id; maps to `X-Request-ID` |
| `parent_span_id` | string          | Optional                                | Parent span when nested                 |

If a background cron job has no upstream HTTP request, it MUST still generate a
new `trace_id` at job start and set `request_id` to the job id or a new UUID.

See
[observability-correlation-and-tracing.md](./observability-correlation-and-tracing.md).

---

## 3. HTTP request context (mre-app API routes)

Include when handling an HTTP request:

| Field              | Type   | Description                                              |
| ------------------ | ------ | -------------------------------------------------------- |
| `http.method`      | string | `GET`, `POST`, …                                         |
| `http.route`       | string | Normalised route, e.g. `/api/v1/events/[eventId]/ingest` |
| `http.path`        | string | Actual path from request                                 |
| `http.status_code` | number | Response status when logging at request end              |
| `http.duration_ms` | number | Wall time for handler                                    |
| `http.user_agent`  | string | Truncated to 512 chars                                   |
| `client.ip`        | string | First IP from `X-Forwarded-For` or equivalent            |
| `user.id`          | string | Authenticated user UUID; omit if anonymous               |

**Mapping from current `LogContext` (`src/lib/logger.ts`):**

| Current field | Schema field       |
| ------------- | ------------------ |
| `requestId`   | `request_id`       |
| `userId`      | `user.id`          |
| `ip`          | `client.ip`        |
| `path`        | `http.path`        |
| `method`      | `http.method`      |
| `userAgent`   | `http.user_agent`  |
| `duration`    | `http.duration_ms` |
| `statusCode`  | `http.status_code` |

During migration, emit **both** camelCase (in nested `context`) and snake_case
top-level fields for one release, then remove camelCase duplicates.

---

## 4. Ingestion domain fields (liverc-ingestion, telemetry-worker)

Include when the log relates to LiveRC ingestion:

| Field                       | Type   | Description                                  |
| --------------------------- | ------ | -------------------------------------------- |
| `ingestion.subsystem`       | string | Always `liverc_ingestion` for this subsystem |
| `ingestion.stage`           | string | Pipeline stage (see §4.1)                    |
| `ingestion.event_id`        | string | MRE event UUID                               |
| `ingestion.source_event_id` | string | LiveRC source id when known                  |
| `ingestion.track_id`        | string | MRE track UUID                               |
| `ingestion.track_slug`      | string | LiveRC track slug                            |
| `ingestion.race_id`         | string | When in race scope                           |
| `ingestion.job_id`          | string | Queue job id when async                      |
| `ingestion.depth`           | string | `none`, `laps_full`, etc.                    |
| `error.code`                | string | Stable error code on warn/error              |
| `error.message`             | string | Human-readable; no stack in message field    |
| `error.stack`               | string | Stack trace on `error` level only            |

### 4.1 Ingestion stage enum

MUST use one of these values for `ingestion.stage` when applicable:

```
discover_tracks
sync_track_catalogue
fetch_event_page
parse_event
fetch_race_page
parse_race_results
parse_laps
normalize_laps
persist_event
persist_race
persist_laps
advisory_lock
queue_enqueue
queue_execute
practice_day_discovery
practice_day_ingest
telemetry_job
connector_fetch
connector_playwright
refresh_recent_events
```

New stages MUST be appended here and in
[15-ingestion-observability.md](./liverc-ingestion/15-ingestion-observability.md).

### 4.2 Required lifecycle messages (ingestion)

These `message` values MUST be used for the corresponding events (aligns with
doc 15):

| `message`                         | `level` | Notes                             |
| --------------------------------- | ------- | --------------------------------- |
| `ingestion_start`                 | info    | Always logged                     |
| `ingestion_finish`                | info    | Include duration, counts          |
| `ingestion_skip_already_complete` | info    |                                   |
| `ingestion_failed`                | error   | Include `error.code`, stage       |
| `event_page_fetched`              | info    | Sampled in prod (see privacy doc) |
| `race_page_fetched`               | info    | Sampled in prod                   |
| `laps_extracted`                  | info    | Sampled in prod                   |
| `db_upsert_summary`               | info    | Always at end of persist phase    |
| `advisory_lock_acquired`          | info    |                                   |
| `advisory_lock_released`          | info    |                                   |
| `advisory_lock_release_failed`    | error   |                                   |
| `advisory_lock_leaked_suspected`  | warn    |                                   |

### 4.3 structlog mapping (Python)

Current structlog JSON uses keys like `event`, `level`, `timestamp`. **Target**
processors MUST rename/normalise to this schema:

| structlog / current      | Schema                          |
| ------------------------ | ------------------------------- |
| `event` or `message` key | `message`                       |
| `level`                  | `level` (lowercase)             |
| `timestamp`              | `timestamp`                     |
| `event_id`               | `ingestion.event_id`            |
| `track_id`               | `ingestion.track_id`            |
| `ingestion_stage`        | `ingestion.stage`               |
| `logger` name            | `logger.name` (optional, debug) |

Add a structlog processor `normalize_mre_log_schema` in Phase 2 (implementation
plan).

---

## 5. Error object shape

On `level: error`, include:

```json
{
  "error": {
    "code": "INGESTION_LOCK_TIMEOUT",
    "message": "Timed out waiting for advisory lock",
    "type": "IngestionLockTimeoutError",
    "stack": "... full stack ..."
  }
}
```

Rules:

- `error.code` MUST be stable for alerting (same code for same failure class).
- Do NOT put PII in `error.message`.
- For API errors, use existing codes from `IngestionServiceError` and
  `handleApiError` responses.

---

## 6. Performance and database telemetry (mre-app)

Optional fields from `createRequestLogger` Prisma enrichment:

| Field                   | Type   | Description                                      |
| ----------------------- | ------ | ------------------------------------------------ |
| `db.prisma_query_count` | number | Queries in request scope                         |
| `db.slow_queries`       | array  | `{ duration_ms, query_truncated }` max 5 entries |
| `perf.operation`        | string | Named operation from `measureOperation`          |
| `perf.duration_ms`      | number |                                                  |
| `perf.threshold_ms`     | number | Threshold exceeded when warn logged              |

---

## 7. Security event fields

From `src/lib/security-logger.ts`:

| Field                        | Type   | Description                           |
| ---------------------------- | ------ | ------------------------------------- |
| `security.event`             | string | e.g. `failed_login`, `rate_limit_hit` |
| `security.identifier_masked` | string | Partially redacted email/username     |
| `client.ip`                  | string |                                       |

Never log raw passwords, session tokens, or full email addresses at any level.

---

## 8. ApplicationLog database mapping

`prisma.applicationLog` persists a subset of fields. Mapping when writing from
`src/lib/logger.ts`:

| Schema field          | DB column                  |
| --------------------- | -------------------------- |
| `level`               | `level`                    |
| `message`             | `message` (max 5000 chars) |
| `service`             | `service`                  |
| entire context object | `context` (JSON)           |
| `request_id`          | `requestId`                |
| `user.id`             | `userId`                   |
| `client.ip`           | `ip`                       |
| `http.path`           | `path`                     |
| `http.method`         | `method`                   |
| `http.user_agent`     | `userAgent`                |

When SaaS is enabled, only persist levels listed in
`APPLICATION_LOG_PERSIST_LEVELS` (default: `warn,error`).

---

## 9. SaaS parser notes (Datadog)

Configure log pipelines to:

1. Parse JSON from `mre-app`, `liverc-ingestion`, `telemetry-worker` sources
2. Remap `@timestamp` ← `timestamp`
3. Facets: `service`, `env`, `ingestion.event_id`, `ingestion.stage`,
   `error.code`, `request_id`, `trace_id`
4. Trace correlation: `trace_id` ↔ APM traces (Datadog standard attribute
   `dd.trace_id` if using dd-trace injection)

---

## 10. Validation

Before merge, new log events SHOULD be checked against:

1. Required envelope present
2. `level` lowercase
3. `message` snake_case or stable kebab from existing ingestion events
4. No forbidden keys (see privacy doc §4)
5. `ingestion.stage` from enum when subsystem is ingestion

Optional: add a JSON Schema file at
`docs/architecture/schemas/log-entry.schema.json` in a follow-up PR.

---

## 11. Migration checklist

- [ ] Next.js: add JSON renderer for production stdout
- [ ] Next.js: map `LogContext` → schema fields in `formatLogEntry` / persist
      path
- [ ] Python: add `normalize_mre_log_schema` structlog processor
- [ ] Python: bind OTel trace ids into structlog contextvars
- [ ] Document parser config in setup runbook
- [ ] Update admin log viewer to display `trace_id` link when present

---

**End of observability-log-schema.md**
