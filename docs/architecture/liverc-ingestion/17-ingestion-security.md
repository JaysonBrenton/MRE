---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Security model for LiveRC ingestion subsystem operations
purpose:
  Defines the security model for the LiveRC ingestion subsystem, including
  authentication, authorization, input validation, and protection against abuse.
  Ensures data integrity and predictable operation for admin-triggered backend
  operations.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md
  - docs/architecture/liverc-ingestion/24-ingestion-security-hardening.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 17. Ingestion Security (LiveRC Ingestion Subsystem)

This document defines the security model for the LiveRC ingestion subsystem in
My Race Engineer (MRE). Although ingestion is admin-triggered and backend-only,
it interacts with external sources, performs privileged operations, and writes
to core database tables. Security must be explicitly defined to protect data
integrity, prevent abuse, and ensure predictable operation.

The goals of ingestion security are:

- prevent unauthorised triggering of ingestion
- prevent parameter tampering that could lead to scraping forbidden sources
- prevent accidental or malicious ingestion overload
- ensure connector execution cannot compromise the system
- ensure stored data cannot be polluted with malformed or malicious upstream
  HTML
- enforce strict boundaries between ingestion, storage, and UI layers

This document complements, but does not duplicate, the ingestion observability
and error handling documents.

---

## 1. Authentication Requirements

All ingestion-triggering operations MUST require administrator authentication.

### 1.1 Requirements

- Only authenticated admins may trigger ingestion via the API.
- API clients must present a valid session token or admin JWT.
- CLI ingestion must run under a privileged environment (machine account or
  admin token).
- Public users must never be able to hit ingestion endpoints.

### 1.2 Ingestion Endpoints Protection

The following must be protected behind admin authentication:

- POST /api/mre/v1/events/{event_id}/ingest
- Any future refresh or bulk ingestion endpoints

GET endpoints used for read-only front-end access remain public or
user-authenticated but NEVER admin-protected unless they expose sensitive data.

---

## 2. Authorisation

Authentication proves who you are. Authorisation decides what you can do.

### 2.1 Admin Role Required

Only users with the admin role may:

- trigger ingestion
- re-ingest events
- test connector browser behaviour
- manage tracks and followed/unfollowed state
- run CLI ingestion tools

### 2.2 Non-Admin Restrictions

Non-admin users may only:

- query tracks
- query events
- view processed race and lap data

They may NOT request ingestion, even for their own races.

---

## 3. Input Validation and Sanitisation

LiveRC ingestion uses external HTML and JSON-like structures. Upstream data
cannot be trusted.

### 3.1 URL Validation

All URLs used by the ingestion pipeline MUST:

- be constructed internally based on known track/event IDs
- NOT accept user-provided URLs
- be validated to ensure the domain matches \*.liverc.com

Open redirects or arbitrary URL scraping is explicitly prohibited.

### 3.2 HTML Content Sanitisation

Before parsing:

- HTML must be treated as untrusted input
- parser must operate in strict, defensive mode
- no HTML content may be displayed unescaped to users
- JavaScript embedded in HTML must never be executed

Playwright is ONLY used to evaluate LiveRC’s own JS for rendering, never for
executing arbitrary scripts.

### 3.3 Numeric and Text Field Validation

Every parsed value must be validated:

- numbers parsed safely (float, int, or null)
- time strings converted to canonical durations
- driver names truncated to safe lengths
- missing values handled explicitly

Malformed inputs must trigger a structured ingestion error, not propagate into
the DB.

---

## 4. Database Security

### 4.1 Principle of Least Privilege

The ingestion process must use a DB role with permissions restricted to:

- INSERT / UPDATE on ingestion tables
- SELECT on ingestion tables
- NO DROP or ALTER permissions
- NO permissions on user accounts or authentication tables

### 4.2 SQL Safety

All DB writes must:

- use parameterised queries
- avoid raw string interpolation
- treat parsed values as untrusted

This prevents SQL injection even if LiveRC upstream data is malformed.

---

## 5. Rate Limiting and Abuse Prevention

Even admin-triggered ingestion must not overload the system or LiveRC’s servers.

### 5.1 Per-Event Rate Limits

- Only one ingestion per event may run at a time
- Minimum cooldown between re-ingestion attempts
- Optional hard limit of N ingestions per hour

### 5.2 Browser Execution Limits

Playwright must enforce:

- max navigation timeout
- max retries
- max concurrent browser tabs
- max memory usage

A runaway ingestion job must not exhaust server resources.

---

## 6. Network Security

### 6.1 Domain Allowlist

Ingestion is only allowed to connect to:

- \*.liverc.com
- localhost (for testing)

No third-party domains may be fetched.

### 6.2 HTTP vs HTTPS

All fetches MUST use HTTPS only.

No HTTP downgrade or redirect following to non-HTTPS endpoints is permitted.

### 6.3 User-Agent Policy

User-Agent MUST be honest and non-deceptive, for example:

"MRE-IngestionBot/1.0 (contact: admin@domain.com)"

This avoids hostile anti-bot detection behaviours and maintains trust.

**See [Web Scraping Best Practices](27-web-scraping-best-practices.md) for
comprehensive documentation of User-Agent policy, robots.txt compliance, rate
limiting, HTTP caching, and all other web scraping best practices.**

---

## 7. Connector Sandbox Requirements

Connector execution (fetch, parse, normalise) must be isolated.

### 7.1 Node / Python Sandbox

If parts of ingestion execute in Python or Node:

- restrict file system access
- restrict network access to allowed domains
- no arbitrary shell execution
- no write-access outside ingestion cache directories

### 7.2 Browser Sandbox

Playwright MUST use:

- headless mode when possible
- isolated contexts per ingestion
- 30–60 second global timeout per page
- safe navigation options (no popup dialogues, no downloads)

---

## 8. Error Redaction

Error messages returned by the API must never leak:

- raw HTML
- upstream JS
- stack traces
- internal file paths
- browser automation errors

Detailed errors go to logs.  
Users receive simplified error envelopes only.

Example safe message:

"Ingestion failed: upstream page structure changed."

---

## 9. Integrity and Idempotency as Security

Ingestion correctness is a security problem.

### 9.1 DB Integrity

The ingestion pipeline must never produce:

- duplicate races
- duplicate drivers
- mismatched lap counts
- inconsistent race ordering

Failures must abort the current transaction.

### 9.2 Idempotent Writes

Re-running ingestion must never:

- multiply lap rows
- create inconsistent snapshots
- overwrite unrelated events

See document 14 for full idempotency rules.

---

## 10. Security Testing Requirements

The ingestion subsystem must support:

- fixture-based ingestion reproducibility
- malformed HTML test cases
- concurrency tests
- timeout tests
- invalid URL injection attempts
- cross-event contamination tests

All ingestion regressions or vulnerabilities must produce:

- structured error logs
- metrics increments
- no silent failures

---

## 11. Future Hardening (Not Required in V1)

### 11.1 Multi-Tenant Isolation

Future versions may run ingestion for multiple clubs or organisations; ingestion
must not reveal cross-tenant data.

### 11.2 Verification of Upstream Identity

Certificate pinning for \*.liverc.com may be considered.

### 11.3 Machine-to-Machine OAuth

If LiveRC ever publishes an official API, ingestion must transition away from
scraping.

---

End of 17-ingestion-security.md.
