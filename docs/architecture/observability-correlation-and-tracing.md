---
created: 2026-06-07
creator: Jayson Brenton
lastModified: 2026-06-07
description: Correlation IDs, W3C trace context, and distributed tracing for MRE
purpose:
  Specifies how request_id, trace_id, and span_id are generated, propagated
  across mre-app → liverc-ingestion → background jobs, and exported via
  OpenTelemetry. Required for cross-service debugging in the observability SaaS
  platform.
relatedFiles:
  - docs/architecture/observability-platform.md
  - docs/architecture/observability-log-schema.md
  - src/lib/request-context.ts
  - src/lib/ingestion-client.ts
  - src/lib/api-performance-wrapper.ts
  - ingestion/common/tracing.py
  - ingestion/api/app.py
status: Normative — proposed with ADR-20260607
---

# Observability Correlation and Tracing

**Status:** Normative (proposed)  
**ADR:** [ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)

---

## 1. Overview

MRE uses **two complementary correlation identifiers**:

| ID                     | Scope                     | Format            | Primary use                                                  |
| ---------------------- | ------------------------- | ----------------- | ------------------------------------------------------------ |
| `request_id`           | MRE application           | UUID v4           | Support/admin reference; API response header; ApplicationLog |
| `trace_id` / `span_id` | Distributed tracing (W3C) | 32 / 16 hex chars | SaaS APM; cross-service span linking                         |

Both MUST appear in logs when inside an instrumented request. The observability
platform links logs to traces via shared `trace_id`.

---

## 2. Current state (gaps)

| Location                                      | Behaviour today                            | Gap                                    |
| --------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `generateRequestId()` in `request-context.ts` | UUID per API handler                       | Not propagated to ingestion HTTP calls |
| `withPerformanceLogging`                      | Sets response `X-Request-ID`               | Not all routes use wrapper             |
| `IngestionClient.performIngestionRequest`     | Headers: `Content-Type` only               | Missing `traceparent`, `X-Request-ID`  |
| `src/core/admin/ingestion.ts`                 | Direct `fetch`                             | Same gap                               |
| `ingest-practice-day.ts`                      | Direct `fetch`                             | Same gap                               |
| `ingestion/common/tracing.py`                 | Log-only `TraceSpan` with random `span_id` | Not linked to upstream API traces      |
| FastAPI ingestion                             | No trace extraction middleware             | Cannot continue parent trace           |

---

## 3. Target: W3C Trace Context

### 3.1 Headers

Use [W3C Trace Context](https://www.w3.org/TR/trace-context/):

| Header          | Direction          | Description                              |
| --------------- | ------------------ | ---------------------------------------- |
| `traceparent`   | Request            | `00-{trace_id}-{span_id}-{flags}`        |
| `tracestate`    | Request            | Optional vendor state                    |
| `X-Request-ID`  | Request + response | MRE UUID; echo in response               |
| `X-MRE-User-ID` | Request (optional) | Authenticated user id for ingestion logs |

### 3.2 Generation rules

**Incoming HTTP to mre-app:**

1. If client sends valid `traceparent`, continue trace (new child span for
   route).
2. Else start new trace with OTel root span.
3. If client sends `X-Request-ID`, use it; else generate new UUID.
4. Store ids in AsyncLocalStorage / request storage (extend
   `src/lib/request-storage.ts`).

**Outgoing HTTP from mre-app to ingestion:**

```typescript
const headers = {
  "Content-Type": "application/json",
  traceparent: getActiveTraceparent(), // from OTel context
  "X-Request-ID": requestId,
  ...(userId && { "X-MRE-User-ID": userId }),
}
```

**Ingestion FastAPI (target middleware):**

1. Extract `traceparent` → OTel parent context
2. Read `X-Request-ID` → bind structlog contextvar `request_id`
3. Start span `ingestion.http.request` for route handler
4. On response, optionally echo `X-Request-ID`

**Background queue worker (ingestion):**

1. When enqueueing, serialize `traceparent` + `request_id` into job payload
2. On job execute, restore context and start child span `ingestion.job.execute`

**Cron / CLI (no upstream HTTP):**

1. Generate new `trace_id` + `request_id` at CLI entry
2. Log both at `job_start`

---

## 4. OpenTelemetry implementation (target)

### 4.1 SDK packages

**Node.js (`mre-app`):**

- `@opentelemetry/api`
- `@opentelemetry/sdk-node`
- `@opentelemetry/instrumentation-http`
- `@opentelemetry/instrumentation-fetch` (or manual spans on `IngestionClient`)
- Exporter: OTLP HTTP **or** Datadog `dd-trace` with OTel bridge

Bootstrap in `src/instrumentation.ts` (Next.js hook), gated by
`OBSERVABILITY_ENABLED`.

**Python (`liverc-ingestion`, `telemetry-worker`):**

- `opentelemetry-api`, `opentelemetry-sdk`
- `opentelemetry-instrumentation-fastapi`
- `opentelemetry-instrumentation-httpx`
- `opentelemetry-exporter-otlp` **or** `ddtrace`

Initialize in `ingestion/api/app.py` lifespan or dedicated
`ingestion/common/telemetry.py`.

### 4.2 Required spans

**mre-app**

| Span name               | When                             |
| ----------------------- | -------------------------------- |
| `HTTP {method} {route}` | Auto via HTTP instrumentation    |
| `ingestion.client.post` | Each `IngestionClient` call      |
| `prisma.query`          | Optional; if Prisma OTel enabled |
| `external.fetch`        | Other outbound HTTP              |

**liverc-ingestion**

| Span name                | When                       |
| ------------------------ | -------------------------- |
| `ingestion.http.request` | FastAPI middleware         |
| `ingestion.job.execute`  | Queue worker               |
| `event_ingestion`        | Pipeline entry             |
| `event_page_fetch`       | Connector fetch event HTML |
| `race_page_fetch`        | Per-race fetch             |
| `lap_extraction`         | Parser                     |
| `db_persistence`         | Repository persist phase   |

Existing log-based spans in `ingestion/common/tracing.py` (`trace_span_start`,
`trace_span_end`) MAY remain during migration but MUST emit OTel span ids
matching log `span_id` fields.

### 4.3 Sampling (production)

| Signal                  | Policy                                                                           |
| ----------------------- | -------------------------------------------------------------------------------- |
| Traces — success        | 10% head sampling (`ParentBased(TraceIdRatioBased(0.1))`)                        |
| Traces — errors         | 100% (always sample when span status ERROR)                                      |
| Traces — ingestion jobs | 100% for `ingestion_failed`; 25% for success                                     |
| Logs                    | Independent sampling (see privacy doc); always include trace_id when span active |

---

## 5. End-to-end example

### 5.1 User triggers event ingest from UI

```
1. Browser → POST /api/v1/events/{id}/ingest
   mre-app:
     trace_id=abc...  span_id=111...  request_id=req-uuid-1
     log: message=request_started

2. mre-app → POST http://liverc-ingestion-service:8000/api/v1/events/{id}/ingest
   Headers: traceparent: 00-abc...-222...-01, X-Request-ID: req-uuid-1

3. liverc-ingestion:
     continues trace abc..., new span 222...
     log: message=ingestion_start ingestion.event_id=...

4. pipeline spans: event_page_fetch → race_page_fetch → … → db_persistence

5. mre-app:
     log: message=event_ingestion_completed http.status_code=200
   Response header: X-Request-ID: req-uuid-1
```

### 5.2 SaaS query

```
trace_id:abc* OR request_id:req-uuid-1
```

Must return logs and spans from both services.

---

## 6. Code change map

| File                                            | Change                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `src/instrumentation.ts`                        | **New** — OTel / dd-trace bootstrap                                        |
| `src/lib/request-context.ts`                    | Export `getActiveTraceContext()`; use `crypto.randomUUID()` for request id |
| `src/lib/request-storage.ts`                    | Store trace + request ids per async context                                |
| `src/lib/ingestion-client.ts`                   | Inject headers on all POST/GET                                             |
| `src/core/admin/ingestion.ts`                   | Use shared `ingestionFetch()` helper with headers                          |
| `src/core/practice-days/ingest-practice-day.ts` | Same                                                                       |
| `ingestion/api/app.py`                          | Trace middleware + structlog context binding                               |
| `ingestion/api/job_queue.py`                    | Serialize/deserialize trace context in job payload                         |
| `ingestion/common/logging.py`                   | Processor: add trace_id, span_id, request_id from contextvars              |
| `ingestion/common/tracing.py`                   | Delegate to OTel or wrap OTel spans                                        |

### 6.1 Shared TypeScript helper (target signature)

```typescript
// src/lib/observability/http-propagators.ts

export interface OutboundContext {
  requestId: string
  userId?: string
}

export function propagationHeaders(ctx: OutboundContext): Record<string, string>
```

All internal service `fetch` calls MUST use this helper.

### 6.2 Python context binding (target)

```python
# ingestion/common/logging.py — contextvars
request_id_var: contextvars.ContextVar[str | None]
trace_id_var: contextvars.ContextVar[str | None]
span_id_var: contextvars.ContextVar[str | None]

def bind_request_context(request_id: str, trace_id: str, span_id: str) -> None: ...
```

---

## 7. Response headers to clients

| Header         | Set by               | Purpose                                  |
| -------------- | -------------------- | ---------------------------------------- |
| `X-Request-ID` | All API routes       | User/support correlation                 |
| `X-Trace-ID`   | Optional convenience | Expose trace_id for support (no secrets) |

Public API docs SHOULD mention `X-Request-ID` for support tickets.

---

## 8. Transition from log-only tracing

During Phase 3 migration:

1. OTel spans become authoritative in SaaS APM
2. `trace_span_start` / `trace_span_end` log events remain for 1 release
3. Remove duplicate span logging when dashboards validated

---

## 9. Testing requirements

### 9.1 Unit tests

- `propagationHeaders()` includes valid W3C `traceparent`
- Python middleware extracts injected `traceparent` into contextvars

### 9.2 Integration test (Docker)

```bash
# Pseudocode flow — see implementation plan for exact test file
docker exec mre-app curl -X POST .../ingest -H "X-Request-ID: test-req-1"
docker logs mre-liverc-ingestion-service 2>&1 | grep test-req-1
# MUST find at least one JSON log line with request_id=test-req-1
```

### 9.3 Acceptance criteria

- [ ] 100% of `IngestionClient` calls include `X-Request-ID`
- [ ] 100% of `IngestionClient` calls include `traceparent` when OTel enabled
- [ ] Ingestion logs for a triggered ingest share `trace_id` with mre-app APM
      trace
- [ ] Queue jobs preserve trace context from enqueue to execute

---

## 10. Related documentation

- [Observability Log Schema](./observability-log-schema.md)
- [Observability Platform](./observability-platform.md)
- [Implementation Plan](../implimentation_plans/observability-platform-remediation-2026-06.md)

---

**End of observability-correlation-and-tracing.md**
