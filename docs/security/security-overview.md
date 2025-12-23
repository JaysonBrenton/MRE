---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Comprehensive security documentation for MRE application
purpose: Provides complete security documentation including authentication, authorization,
         password security, API security, data protection, and security best practices.
         Ensures security architecture is well-documented and security best practices are followed.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md (security rules)
  - docs/architecture/liverc-ingestion/17-ingestion-security.md (ingestion security)
  - src/core/auth/ (authentication implementation)
  - src/lib/auth.ts (NextAuth configuration)
  - middleware.ts (route protection)
---

# Security Overview

**Last Updated:** 2025-01-27  
**Scope:** All security aspects of the MRE application

This document provides comprehensive security documentation covering authentication, authorization, password security, API security, data protection, and security best practices.

---

## Table of Contents

1. [Authentication Architecture](#authentication-architecture)
2. [Authorization Model](#authorization-model)
3. [Password Security](#password-security)
4. [Session Management](#session-management)
5. [API Security](#api-security)
6. [Data Protection](#data-protection)
7. [Security Headers](#security-headers)
8. [Dependency Security](#dependency-security)
9. [Security Best Practices](#security-best-practices)
10. [Incident Response Procedures](#incident-response-procedures)

---

## Authentication Architecture

### Overview

MRE uses NextAuth.js for authentication with credential-based provider. The architecture supports both web (cookie-based) and future mobile (token-based) authentication.

### Authentication Flow

1. **User Registration**
   - User provides email, password, driverName (optional teamName)
   - Password is hashed using Argon2id
   - User account created with `isAdmin: false` (security requirement)
   - Admin accounts cannot be created via registration

2. **User Login**
   - User provides email and password
   - Credentials validated against database
   - Session created via NextAuth (JWT strategy)
   - Cookie set for web clients

3. **Session Management**
   - JWT tokens stored in cookies (web)
   - Tokens include user ID, email, name, and isAdmin flag
   - Sessions validated on protected routes

### Implementation

**Configuration:** `src/lib/auth.ts`

**Key Features:**
- Credential-based authentication
- JWT session strategy
- Route protection via middleware
- Admin role checking

**Business Logic:** `src/core/auth/` (mobile-safe architecture)

---

## Authorization Model

### Role-Based Access Control

**Roles:**
- **User** - Default role for registered users
- **Admin** - Privileged role for administrative tasks

### User Permissions

**Regular Users Can:**
- View tracks and events
- View race data and lap times
- Access their own profile (future)

**Regular Users Cannot:**
- Trigger ingestion
- Access admin console
- Modify other users' data
- Create admin accounts

### Admin Permissions

**Admins Can:**
- Trigger event ingestion
- Access admin console
- Manage tracks (follow/unfollow)
- View all user data (future)

**Admin Account Creation:**
- Admin accounts MUST be created via:
  - Database seed script
  - Database migration
  - Manual database update
- Admin accounts CANNOT be created via registration endpoint

### Authorization Implementation

**Route Protection:** `middleware.ts`

**Admin Checks:**
```typescript
// In API routes or server actions
import { requireAdmin } from "@/core/auth/session"

const adminUser = await requireAdmin(session)
// Throws error if not admin
```

**UI Protection:**
- Admin routes protected by middleware
- Non-admin users redirected to welcome page
- Admin UI components check `session.user.isAdmin`

**Placeholder for future documentation:**
- Fine-grained permissions
- Resource-level authorization
- API key authentication for services

---

## Password Security

### Password Hashing

**Algorithm:** Argon2id

**Why Argon2id:**
- Resistant to GPU-based attacks
- Memory-hard function
- Recommended by OWASP
- Required by mobile-safe architecture guidelines

**Implementation:**
```typescript
import argon2 from "argon2"

// Hash password
const passwordHash = await argon2.hash(password)

// Verify password
const isValid = await argon2.verify(passwordHash, password)
```

**Location:** `src/core/auth/register.ts`, `src/core/auth/login.ts`

### Password Requirements

**Placeholder:** Password requirements not yet enforced

**Recommended Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Future Implementation:**
- Client-side validation
- Server-side validation
- Password strength meter

### Password Storage

- Passwords are NEVER stored in plain text
- Only password hashes are stored in database
- Password hashes stored in `users.passwordHash` field
- Original passwords cannot be recovered

---

## Session Management

### Session Strategy

**Type:** JWT (JSON Web Tokens)

**Storage:**
- Web: HTTP-only cookies
- Future Mobile: Tokens in secure storage

### Session Configuration

**Key Settings:**
- JWT tokens signed with `AUTH_SECRET`
- Tokens include user ID, email, name, isAdmin
- Sessions validated on protected routes
- Session expiration handled by NextAuth

### Session Security

**Cookie Settings (NextAuth Defaults):**
- HTTP-only (prevents XSS)
- Secure flag (HTTPS only in production)
- SameSite protection (CSRF prevention)

**Token Security:**
- Tokens signed with secret key
- Tokens include expiration
- Tokens validated on each request

---

## API Security

### Authentication Requirements

**Current State (Alpha):**
- Most endpoints do not require authentication
- Authentication endpoints are public
- Admin endpoints may require authentication in future

**Future State:**
- All data endpoints will require authentication
- Admin endpoints will require admin role
- Rate limiting will be implemented

### API Security Patterns

**Input Validation:**
- All inputs validated using Zod schemas
- Type checking on all API routes
- Sanitization of user inputs

**Error Handling:**
- Generic error messages to prevent information leakage
- No stack traces exposed to clients
- Structured error responses

**CORS:**
- **Placeholder:** CORS configuration not yet implemented
- Will be configured for production domains

**Rate Limiting:**
Rate limiting is implemented to protect authentication and resource-intensive endpoints from abuse.

**Implementation:** `src/lib/rate-limiter.ts`, `middleware.ts`

**Protected Endpoints:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/v1/auth/login` | 5 requests | 15 minutes |
| `/api/v1/auth/register` | 10 requests | 1 hour |
| `/api/v1/events/*/ingest` | 10 requests | 1 minute |
| `/api/v1/events/discover` | 20 requests | 1 minute |

**Response Headers:**
- `Retry-After` - Seconds until rate limit resets
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in window
- `X-RateLimit-Reset` - Unix timestamp when limit resets

**Rate Limit Response (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfterSeconds": 60
    }
  }
}
```

**Note:** Current implementation uses in-memory storage. For production clusters, consider Redis-based rate limiting for persistence across server restarts and distributed environments.

### API Security Best Practices

1. **Validate all inputs** - Never trust client input
2. **Use parameterized queries** - Prevent SQL injection (Prisma handles this)
3. **Return generic errors** - Don't expose internal details
4. **Log security events** - Track authentication failures
5. **Use HTTPS** - Encrypt all traffic in production

---

## Data Protection

### Encryption

**In Transit:**
- **Placeholder:** HTTPS configuration for production
- All API traffic encrypted via HTTPS

**At Rest:**
- **Placeholder:** Database encryption configuration
- Passwords hashed (not encrypted)
- Sensitive data encryption (if needed)

### PII Handling

**Personal Information Stored:**
- Email addresses
- Driver names
- Team names (optional)

**Protection:**
- Email addresses used for authentication
- Driver names displayed in UI
- No additional PII collected in Alpha

**Placeholder for future documentation:**
- PII retention policies
- Data deletion procedures
- GDPR compliance

### Database Security

**Connection Security:**
- Database credentials in environment variables
- Connection strings not committed to repository
- **Placeholder:** SSL/TLS for production database connections

**Access Control:**
- Database user has minimal required permissions
- No direct database access from client
- All access via Prisma ORM

---

## Security Headers

**Placeholder:** Security headers configuration not yet implemented

**Recommended Headers:**
- `Content-Security-Policy` - Prevent XSS attacks
- `X-Frame-Options` - Prevent clickjacking
- `X-Content-Type-Options` - Prevent MIME sniffing
- `Strict-Transport-Security` - Force HTTPS
- `Referrer-Policy` - Control referrer information

**Future Implementation:**
- Configure headers in Next.js middleware
- Test headers with security scanner
- Document header configuration

---

## Dependency Security

### Vulnerability Scanning

**Placeholder:** Automated vulnerability scanning not yet implemented

**Recommended Tools:**
- `npm audit` - Node.js dependency scanning
- `pip-audit` - Python dependency scanning
- Dependabot - Automated dependency updates
- Snyk - Continuous security monitoring

### Dependency Management

**Current Practices:**
- Dependencies listed in `package.json` and `requirements.txt`
- Version pinning for production
- Regular dependency updates

**Best Practices:**
- Review security advisories
- Update dependencies regularly
- Test updates before deployment
- Use dependency lock files

---

## Security Best Practices

### For Developers

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Never trust client data
3. **Use parameterized queries** - Prevent SQL injection
4. **Hash passwords** - Never store plain text passwords
5. **Log security events** - Track authentication failures
6. **Keep dependencies updated** - Patch security vulnerabilities
7. **Use HTTPS** - Encrypt all traffic
8. **Follow principle of least privilege** - Minimal permissions
9. **Review code changes** - Security-focused code reviews
10. **Test security** - Include security in testing

### For Operations

1. **Rotate secrets regularly** - Change passwords and keys
2. **Monitor logs** - Watch for security events
3. **Backup securely** - Encrypt backups
4. **Update systems** - Keep infrastructure updated
5. **Limit access** - Restrict database and server access
6. **Use firewalls** - Restrict network access
7. **Enable logging** - Audit trail for security events

---

## Incident Response Procedures

**Placeholder:** Incident response procedures will be documented

### Security Incident Types

1. **Data Breach** - Unauthorized access to user data
2. **Authentication Bypass** - Security vulnerability exploited
3. **DDoS Attack** - Service availability attack
4. **Malware** - Malicious code in system
5. **Credential Theft** - Stolen passwords or tokens

### Response Steps

**Placeholder for future documentation:**
1. **Detection** - Identify security incident
2. **Containment** - Isolate affected systems
3. **Investigation** - Determine scope and impact
4. **Remediation** - Fix vulnerabilities
5. **Recovery** - Restore services
6. **Post-Incident** - Review and improve

### Contact Information

**Placeholder:** Security contact information will be documented

---

## Related Documentation

- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Security rules and architecture
- [Ingestion Security](../architecture/liverc-ingestion/17-ingestion-security.md) - Ingestion-specific security
- [Environment Variables Reference](../operations/environment-variables.md) - Secret management
- [API Reference](../api/api-reference.md) - API security requirements

---

**End of Security Overview**

