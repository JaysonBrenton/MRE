---
created: 2025-01-27
creator: Auto (AI Assistant)
lastModified: 2025-01-27
description: Rate limiting implementation documentation for MRE API
purpose: Documents the rate limiting implementation that protects API endpoints from abuse. Rate limiting is currently implemented using an in-memory sliding window algorithm.
relatedFiles:
  - middleware.ts
  - src/app/api/v1/**/*.ts
---

# Rate Limiting Implementation

## Overview

Rate limiting is **implemented** to protect API endpoints from abuse and ensure fair resource usage. The implementation uses an in-memory sliding window algorithm and is applied via Next.js middleware and inline checks in API routes.

## Implementation Status

**Status:** ✅ **Implemented** (Alpha Release)

Rate limiting is currently implemented and active. The implementation includes:

1. ✅ **Per-IP Rate Limiting**: Requests are limited per IP address
2. ⏳ **Per-User Rate Limiting**: Not yet implemented (planned for future)
3. ✅ **Endpoint-Specific Limits**: Different limits configured per endpoint type
4. ✅ **Rate Limit Headers**: Headers included in all responses
5. ✅ **Graceful Error Messages**: Standardized error format with retry information

## Current Implementation

The current implementation uses an **in-memory sliding window algorithm** (`src/lib/rate-limiter.ts`):

- **Algorithm**: Sliding window with automatic cleanup
- **Storage**: In-memory Map (resets on server restart)
- **Key Format**: `{ip}:{pathname}` (e.g., `192.168.1.1:/api/v1/auth/login`)
- **Cleanup**: Automatic cleanup of expired entries every 5 minutes
- **Location**: Applied via Next.js middleware (`middleware.ts`) and inline checks in API routes

**Implementation Files:**
- `src/lib/rate-limiter.ts` - Rate limiter class and utilities
- `middleware.ts` - Applies rate limiting to API routes
- `src/app/api/v1/events/[eventId]/ingest/route.ts` - Inline rate limit check example

**Limitations:**
- Rate limits reset on server restart (in-memory storage)
- Not suitable for multi-instance deployments (each instance has separate limits)
- For production clusters, consider migrating to Redis-based rate limiting (see Future section)

## Current Rate Limit Configuration

Rate limits are configured in `src/lib/rate-limiter.ts`:

**Authentication Endpoints** (`/api/v1/auth/login`, `/api/v1/auth/register`):
- 5 requests per 15 minutes per IP

**Registration Endpoint** (`/api/v1/auth/register`):
- 10 requests per hour per IP

**Ingestion Endpoints** (`/api/v1/events/{id}/ingest`, `/api/v1/events/ingest`):
- 10 requests per minute per IP
- Applied inline in route handlers

**Discovery Endpoint** (`/api/v1/events/discover`):
- 20 requests per minute per IP

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds until rate limit resets (on 429 responses)

**Error Responses:**
- Returns 429 Too Many Requests status code
- Uses standardized error format with `RATE_LIMIT_EXCEEDED` code
- Includes retry-after information in error details

## Migration to Redis-Based Rate Limiting (Future)

For production deployments with multiple instances, consider migrating to Redis-based rate limiting:

1. **Choose Rate Limiting Library**
   - Evaluate Upstash vs. Redis solution
   - Consider deployment architecture (single instance vs. distributed)

2. **Migrate Rate Limiter Implementation**
   - Replace in-memory RateLimiter with Redis-backed implementation
   - Maintain same API surface for route handlers
   - Update middleware to use new implementation

3. **Add Per-User Rate Limiting**
   - Implement authenticated user rate limiting (higher limits)
   - Use user ID instead of IP for authenticated requests
   - Configure different limits for authenticated vs unauthenticated users

4. **Update Configuration**
   - Add Redis connection environment variables
   - Configure per-user limits
   - Update rate limit headers to reflect user-based limits

## Environment Variables

```env
# For Upstash Redis (if using Option 1)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Rate limiting configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_LIMIT=10
RATE_LIMIT_AUTH_WINDOW=900  # 15 minutes in seconds
RATE_LIMIT_DATA_LIMIT=100
RATE_LIMIT_DATA_WINDOW=60   # 1 minute in seconds
```

## Testing

- Test rate limit enforcement
- Test rate limit headers in responses
- Test error responses (429 status)
- Test limit reset behavior
- Test per-IP vs. per-user limits

## Future Enhancements

- Dynamic rate limiting based on user tier
- Rate limiting for Python ingestion service
- Monitoring and alerting for rate limit violations
- Whitelist for trusted IPs/users

## References

- [Upstash Rate Limit Documentation](https://upstash.com/docs/oss/redis/sdks/ts/ratelimit)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [RFC 6585 - 429 Too Many Requests](https://tools.ietf.org/html/rfc6585)
