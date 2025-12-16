---
created: 2025-01-27
creator: Auto (AI Assistant)
lastModified: 2025-01-27
description: Plan for implementing rate limiting in MRE API
purpose: Documents the approach for implementing rate limiting to protect API endpoints from abuse. Implementation planned for Beta release.
relatedFiles:
  - middleware.ts
  - src/app/api/v1/**/*.ts
---

# Rate Limiting Implementation Plan

## Overview

Rate limiting will be implemented to protect API endpoints from abuse and ensure fair resource usage. This is planned for Beta release per Sonnet.4 review recommendations.

## Requirements

1. **Per-IP Rate Limiting**: Limit requests per IP address
2. **Per-User Rate Limiting**: Limit requests per authenticated user (higher limits)
3. **Endpoint-Specific Limits**: Different limits for different endpoint types
4. **Rate Limit Headers**: Include rate limit information in responses
5. **Graceful Error Messages**: Clear messages when limits are exceeded

## Recommended Implementation

### Option 1: Upstash Rate Limit (Recommended)

**Library:** `@upstash/ratelimit` with `@upstash/redis`

**Pros:**
- Redis-backed (distributed, works across instances)
- Simple API
- Good TypeScript support
- Works with serverless

**Implementation:**
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Per-IP rate limiter (unauthenticated)
export const ipRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
  analytics: true,
})

// Per-user rate limiter (authenticated)
export const userRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(500, "1 m"), // 500 requests per minute
  analytics: true,
})
```

### Option 2: In-Memory Rate Limiting (Simple, Alpha-Safe)

**Library:** Custom implementation or `express-rate-limit` adapted for Next.js

**Pros:**
- No external dependencies
- Simple to implement
- Works for single-instance deployments

**Cons:**
- Doesn't work across multiple instances
- Not suitable for production scaling

## Implementation Steps

1. **Choose Rate Limiting Library**
   - Evaluate Upstash vs. in-memory solution
   - Consider deployment architecture (single instance vs. distributed)

2. **Create Rate Limiting Middleware**
   - File: `src/lib/rate-limit.ts`
   - Implement per-IP and per-user limiters
   - Configure limits per endpoint type

3. **Apply to API Routes**
   - Add rate limiting to authentication endpoints (stricter limits)
   - Add rate limiting to data endpoints (moderate limits)
   - Health endpoint can have higher limits or be exempt

4. **Add Rate Limit Headers**
   - `X-RateLimit-Limit`: Maximum requests allowed
   - `X-RateLimit-Remaining`: Remaining requests
   - `X-RateLimit-Reset`: Time when limit resets

5. **Error Responses**
   - Return 429 Too Many Requests
   - Include retry-after header
   - Use standardized error format

## Rate Limit Configuration

### Recommended Limits

**Authentication Endpoints** (`/api/v1/auth/*`):
- Unauthenticated: 10 requests per 15 minutes per IP
- Authenticated: 50 requests per 15 minutes per user

**Data Endpoints** (`/api/v1/events/*`, `/api/v1/tracks/*`, etc.):
- Unauthenticated: 100 requests per minute per IP
- Authenticated: 500 requests per minute per user

**Health Endpoint** (`/api/health`):
- Exempt from rate limiting (or very high limit)

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
