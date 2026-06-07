---
created: 2025-01-27
lastModified: 2026-06-07
description:
  Logging architecture for the MRE Next.js application and cross-service
  guidelines
purpose:
  Documents current logging implementation, target observability integration,
  usage patterns, and migration guidelines. For platform-wide observability see
  observability-platform.md; for canonical JSON fields see
  observability-log-schema.md.
relatedFiles:
  - docs/architecture/observability-platform.md
  - docs/architecture/observability-log-schema.md
  - docs/architecture/observability-correlation-and-tracing.md
  - docs/architecture/observability-sampling-retention-and-privacy.md
  - docs/adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md
  - src/lib/logger.ts
  - src/lib/client-logger.ts
  - src/lib/request-context.ts
status: Alpha implementation; production SaaS target per ADR-20260607
---

# Logging Architecture

**Created:** 2025-01-27  
**Last Updated:** 2026-06-07  
**Status:** Alpha (in migration to observability platform)  
**Scope:** Next.js application logging and cross-runtime guidelines

## Overview

The MRE application uses **structured logging** to capture errors, performance
signals, and security events. Implementation today:

| Layer              | Mechanism                                   | Output                                        |
| ------------------ | ------------------------------------------- | --------------------------------------------- |
| Server (API, core) | `src/lib/logger.ts`                         | Console + batched `ApplicationLog` (Postgres) |
| Client (React)     | `src/lib/client-logger.ts`                  | Browser console only                          |
| Ingestion (Python) | structlog via `ingestion/common/logging.py` | JSON stdout                                   |

**Target (final release):** OpenTelemetry-instrumented logs exported to a
third-party SaaS platform; Postgres `ApplicationLog` retains **warn/error only**
when SaaS is enabled. See
[ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md).

**Normative specs:**

- [observability-platform.md](./observability-platform.md)
- [observability-log-schema.md](./observability-log-schema.md)
- [observability-correlation-and-tracing.md](./observability-correlation-and-tracing.md)
- [observability-sampling-retention-and-privacy.md](./observability-sampling-retention-and-privacy.md)

---

## Log levels

| Level     | Server console | Client console | ApplicationLog DB         | SaaS (target)        |
| --------- | -------------- | -------------- | ------------------------- | -------------------- |
| **DEBUG** | Dev only       | Dev only       | No                        | Sampled / dev only   |
| **INFO**  | Yes            | Yes            | Yes (dev); No (prod SaaS) | Yes                  |
| **WARN**  | Yes            | Yes            | Yes                       | Yes                  |
| **ERROR** | Yes            | Yes            | Yes (immediate flush)     | Yes + error tracking |

---

## Log structure

### Current format (console)

```
[TIMESTAMP] [LEVEL] MESSAGE {JSON_CONTEXT}
```

Example:

```
[2026-06-07T10:30:45.123Z] [ERROR] API error {"requestId":"abc-123","path":"/api/v1/events/search","method":"GET","ip":"192.168.1.1"}
```

### Target format (production stdout + SaaS)

Single-line JSON per
[observability-log-schema.md](./observability-log-schema.md):

```json
{
  "timestamp": "2026-06-07T10:30:45.123Z",
  "level": "error",
  "message": "api_error",
  "service": "mre-app",
  "env": "production",
  "version": "abc1234",
  "request_id": "abc-123",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "http.method": "GET",
  "http.path": "/api/v1/events/search",
  "client.ip": "192.168.1.1"
}
```

---

## Request context

Server-side logs SHOULD include request context via `createRequestLogger()`:

| Field (current) | Schema field (target) | Description                                         |
| --------------- | --------------------- | --------------------------------------------------- |
| `requestId`     | `request_id`          | Unique per HTTP request; returned as `X-Request-ID` |
| `userId`        | `user.id`             | Authenticated user                                  |
| `ip`            | `client.ip`           | Client IP                                           |
| `path`          | `http.path`           | Request path                                        |
| `method`        | `http.method`         | HTTP method                                         |
| `userAgent`     | `http.user_agent`     | Client user agent                                   |
| `duration`      | `http.duration_ms`    | Request duration                                    |
| `statusCode`    | `http.status_code`    | Response status                                     |

Implementation: `src/lib/request-context.ts` — also attaches Prisma query count
and slow queries to INFO logs.

**Gap (Phase 1):** `request_id` and W3C trace context are **not yet propagated**
to the ingestion service on internal `fetch` calls. See
[observability-correlation-and-tracing.md](./observability-correlation-and-tracing.md).

---

## ApplicationLog persistence

`src/lib/logger.ts` buffers logs and writes to `ApplicationLog` via Prisma:

- Buffer flush: every 5 seconds, 50 entries, or immediately on error
- Failures never break the application
- Skipped in browser context

**Production target when `OBSERVABILITY_ENABLED=true`:**

- Persist only levels in `APPLICATION_LOG_PERSIST_LEVELS` (default:
  `warn,error`)
- Full operational history lives in SaaS log index

Admin UI: `/admin/logs` via `src/core/admin/logs.ts`.

---

## AuditLog (separate from application logging)

Admin and domain actions use `src/core/admin/audit.ts` → Postgres `AuditLog`.
This is an **audit trail**, not operational logging. It remains in Postgres when
SaaS is enabled. UI: `/admin/audit`.

---

## Usage examples

### Basic logging

```typescript
import { logger } from "@/lib/logger"

logger.info("Operation completed", { operationId: "123" })
logger.error("Operation failed", { error: error.message })
```

### Request context logging

```typescript
import { createRequestLogger, generateRequestId } from "@/lib/request-context"

const requestId = generateRequestId()
const requestLogger = createRequestLogger(request, requestId)

requestLogger.info("Request processed", { resultCount: 10 })
```

### Performance logging

```typescript
import { logSlowRequest, measureOperation } from "@/lib/performance-logger"

logSlowRequest("/api/v1/events", "GET", duration, context)

await measureOperation("fetchEvents", async () => fetchEvents(), context)
```

### Security logging

```typescript
import { logFailedLogin, logRateLimitHit } from "@/lib/security-logger"

logFailedLogin("user@example.com", "192.168.1.1", userAgent, "Invalid password")
logRateLimitHit("192.168.1.1", "/api/v1/auth/login", 5, 60)
```

### Client components

```typescript
import { clientLogger } from "@/lib/client-logger"

clientLogger.error("Component render failed", { component: "EventRow" })
```

Do **not** import `@/lib/logger` in client components (Prisma dependency).

### Error handling

```typescript
import { handleApiError } from "@/lib/server-error-handler"

try {
  // ...
} catch (error) {
  const errorInfo = handleApiError(error, request, requestId)
  return errorResponse(
    errorInfo.code,
    errorInfo.message,
    undefined,
    errorInfo.statusCode
  )
}
```

---

## Performance thresholds

Configurable via environment variables (see `src/lib/performance-logger.ts`):

| Variable                  | Default | Purpose                    |
| ------------------------- | ------- | -------------------------- |
| `PERF_THRESHOLD_API`      | 300 ms  | Slow API request warn      |
| `PERF_THRESHOLD_DB`       | 100 ms  | Slow DB operation warn     |
| `PERF_THRESHOLD_EXTERNAL` | 500 ms  | Slow external service warn |

---

## Security considerations

- **Never log sensitive data:** passwords, tokens, API keys, full
  `Authorization` headers
- **Sanitize identifiers:** use `security-logger` masking for emails
- **IP addresses:** allowed for security monitoring; see privacy doc for
  retention
- **User IDs:** allowed for audit and debugging

Full rules:
[observability-sampling-retention-and-privacy.md](./observability-sampling-retention-and-privacy.md).

---

## Migration from console.\*

| Avoid             | Use instead                                 |
| ----------------- | ------------------------------------------- |
| `console.error()` | `logger.error()` or `requestLogger.error()` |
| `console.warn()`  | `logger.warn()`                             |
| `console.log()`   | `logger.debug()` or `logger.info()`         |
| `console.info()`  | `logger.info()`                             |

In client code use `clientLogger`.

---

## Global error handlers

### Client-side

`GlobalErrorHandler` catches uncaught errors and unhandled rejections via
`clientLogger`. **Target:** forward to Sentry or Datadog RUM when
`OBSERVABILITY_ENABLED=true`.

### Server-side

- `handleApiError()` — API errors
- `handlePrismaError()` — database errors
- `handleExternalServiceError()` — external service errors

---

## Observability platform integration (target)

| Phase | Deliverable                          | Doc                                                                                          |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1     | Correlation headers + error tracking | [implementation plan](../implimentation_plans/observability-platform-remediation-2026-06.md) |
| 2     | JSON stdout + log shipping           | [setup runbook](../operations/observability-platform-setup-runbook.md)                       |
| 3     | OTel traces + `/metrics`             | [observability-guide](../operations/observability-guide.md)                                  |
| 4     | Alerts + DB log retention            | [alerting runbook](../operations/observability-alerting-runbook.md)                          |

Master switch: `OBSERVABILITY_ENABLED` (default `false` in local dev).

---

## Related files

| File                                    | Purpose                                    |
| --------------------------------------- | ------------------------------------------ |
| `src/lib/logger.ts`                     | Server logger + ApplicationLog persistence |
| `src/lib/client-logger.ts`              | Browser logger                             |
| `src/lib/request-context.ts`            | Request context + request logger           |
| `src/lib/performance-logger.ts`         | Slow operation warnings                    |
| `src/lib/security-logger.ts`            | Security events                            |
| `src/lib/server-error-handler.ts`       | Standardised API error handling            |
| `src/lib/api-performance-wrapper.ts`    | Route wrapper; sets `X-Request-ID`         |
| `src/lib/ingestion-client.ts`           | HTTP client to Python service              |
| `src/core/admin/logs.ts`                | Admin log retrieval                        |
| `src/core/admin/audit.ts`               | Audit log writes                           |
| `src/components/GlobalErrorHandler.tsx` | Client global errors                       |
| `ingestion/common/logging.py`           | Python structlog configuration             |

---

**End of logging.md**
