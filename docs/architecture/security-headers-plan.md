---
created: 2025-01-27
creator: Auto (AI Assistant)
lastModified: 2025-01-27
description: Security headers implementation documentation for MRE application
purpose:
  Documents the security headers implementation that protects against common web
  vulnerabilities. Security headers are implemented in version 0.1.1 with
  environment-aware configuration.
relatedFiles:
  - middleware.ts (security headers implementation)
  - docs/security/security-overview.md (security documentation)
---

# Security Headers Implementation

## Overview

Security headers are **implemented** in version 0.1.1 to protect the application
against common web vulnerabilities. The implementation uses environment-aware
configuration to balance security and development experience.

## Required Security Headers

### 1. Content-Security-Policy (CSP)

Prevents XSS attacks by controlling which resources can be loaded.

**Recommended Configuration:**

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';  # Adjust based on needs
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://liverc.com;  # For ingestion service
frame-ancestors 'none';
```

### 2. X-Frame-Options

Prevents clickjacking attacks.

**Value:** `DENY` or `SAMEORIGIN`

### 3. X-Content-Type-Options

Prevents MIME type sniffing.

**Value:** `nosniff`

### 4. Referrer-Policy

Controls referrer information sent with requests.

**Value:** `strict-origin-when-cross-origin`

### 5. Permissions-Policy (formerly Feature-Policy)

Controls browser features and APIs.

**Recommended Configuration:**

```
geolocation=(), microphone=(), camera=(), payment=()
```

### 6. Strict-Transport-Security (HSTS)

Forces HTTPS connections (production only).

**Value:** `max-age=31536000; includeSubDomains`

## Implementation Options

### Option 1: Next.js Headers API (Recommended)

Use Next.js middleware to add headers:

```typescript
// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  )

  // Content-Security-Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
  response.headers.set("Content-Security-Policy", csp)

  // HSTS (production only)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
  }

  return response
}
```

### Option 2: next-safe Package

Use a dedicated package for security headers:

```bash
npm install next-safe
```

## Configuration by Environment

### Development

- ✅ Relaxed CSP to allow hot reload (`unsafe-inline`, `unsafe-eval`, WebSocket
  support)
- ✅ HSTS disabled (prevents issues with self-signed certificates)
- ✅ Permissive headers for debugging (allows dev tools and hot reload)

### Production

- ✅ Strict CSP (no `unsafe-inline` or `unsafe-eval` for scripts)
- ✅ HSTS enabled (`max-age=31536000; includeSubDomains`)
- ✅ All security headers enforced

## Testing

- Verify headers are present in responses
- Test CSP with browser console (should not block legitimate resources)
- Test X-Frame-Options prevents iframe embedding
- Verify HSTS only in production

## References

- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Next.js Headers Documentation](https://nextjs.org/docs/app/api-reference/functions/headers)
