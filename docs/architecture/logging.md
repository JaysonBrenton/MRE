# Logging Architecture

**Created:** 2025-01-27  
**Status:** Alpha  
**Scope:** Logging infrastructure and guidelines

## Overview

The MRE application uses structured logging throughout to capture errors,
performance metrics, and security events. All logging is console-based in Alpha
(per architecture guidelines), with structured JSON context for easy parsing and
future integration with logging services.

## Log Levels

- **DEBUG**: Detailed information for debugging (only in development)
- **INFO**: General informational messages (successful operations, etc.)
- **WARN**: Warning messages (slow operations, validation errors, etc.)
- **ERROR**: Error messages (exceptions, failures, etc.)

## Log Structure

All log entries follow this structure:

```
[TIMESTAMP] [LEVEL] MESSAGE {JSON_CONTEXT}
```

Example:

```
[2025-01-27T10:30:45.123Z] [ERROR] API error {"requestId":"abc-123","path":"/api/v1/events/search","method":"GET","ip":"192.168.1.1","error":{"name":"Error","message":"Database connection failed"}}
```

## Request Context

All server-side logs include request context when available:

- `requestId`: Unique identifier for the request
- `userId`: Authenticated user ID (if available)
- `ip`: Client IP address
- `path`: Request path
- `method`: HTTP method
- `userAgent`: Client user agent
- `duration`: Request duration in milliseconds
- `statusCode`: HTTP status code

## Usage Examples

### Basic Logging

```typescript
import { logger } from "@/lib/logger"

logger.info("Operation completed", { operationId: "123" })
logger.error("Operation failed", { error: error.message })
```

### Request Context Logging

```typescript
import { createRequestLogger, generateRequestId } from "@/lib/request-context"

const requestId = generateRequestId()
const requestLogger = createRequestLogger(request, requestId)

requestLogger.info("Request processed", { resultCount: 10 })
```

### Performance Logging

```typescript
import { logSlowRequest, measureOperation } from "@/lib/performance-logger"

// Log slow requests
logSlowRequest("/api/v1/events", "GET", duration, context)

// Measure operation
await measureOperation(
  "fetchEvents",
  async () => {
    return await fetchEvents()
  },
  context
)
```

### Security Logging

```typescript
import { logFailedLogin, logRateLimitHit } from "@/lib/security-logger"

logFailedLogin("user@example.com", "192.168.1.1", userAgent, "Invalid password")
logRateLimitHit("192.168.1.1", "/api/v1/auth/login", 5, 60)
```

### Error Handling

```typescript
import { handleApiError } from "@/lib/server-error-handler"

try {
  // ... operation
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

## Performance Thresholds

Default thresholds (configurable via environment variables):

- **API Requests**: 300ms (`PERF_THRESHOLD_API`)
- **Database Queries**: 100ms (`PERF_THRESHOLD_DB`)
- **External Services**: 500ms (`PERF_THRESHOLD_EXTERNAL`)

## Security Considerations

- **Never log sensitive data**: Passwords, tokens, API keys, etc.
- **Sanitize identifiers**: Email addresses and usernames should be partially
  masked
- **IP addresses**: Can be logged for security monitoring
- **User IDs**: Can be logged for audit trails

## Migration from console.\*

All `console.*` calls should be migrated to use the structured logger:

- `console.error()` → `logger.error()` or `requestLogger.error()`
- `console.warn()` → `logger.warn()` or `requestLogger.warn()`
- `console.log()` → `logger.debug()` (for debug) or `logger.info()` (for info)
- `console.info()` → `logger.info()`

## Global Error Handlers

### Client-Side

The `GlobalErrorHandler` component automatically catches:

- Uncaught JavaScript errors
- Unhandled promise rejections

These are logged with context (URL, user agent, etc.).

### Server-Side

Server-side errors are handled by:

- `handleApiError()` - Standardized API error handling
- `handlePrismaError()` - Database error handling
- `handleExternalServiceError()` - External service error handling

## Future Enhancements

In production (post-Alpha), logging can be extended to:

- Send logs to external services (Sentry, DataDog, etc.)
- Aggregate logs in centralized system
- Set up alerts for critical errors
- Performance monitoring dashboards

## Related Files

- `src/lib/logger.ts` - Core logging infrastructure
- `src/lib/request-context.ts` - Request context utilities
- `src/lib/server-error-handler.ts` - Server-side error handling
- `src/lib/performance-logger.ts` - Performance logging
- `src/lib/security-logger.ts` - Security event logging
- `src/components/GlobalErrorHandler.tsx` - Client-side error handler
