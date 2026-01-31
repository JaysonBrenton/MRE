# 25. HTTPX Client Architecture

This document defines the enterprise-grade HTTPX subsystem used by the LiveRC
ingestion pipeline in My Race Engineer (MRE). It specifies all behaviours
required to ensure stable, predictable, anti-bot-friendly operation.

This file is authoritative. Connector implementations must comply exactly with
the rules and guarantees defined here.

**Related Documentation:**

- [Web Scraping Best Practices](27-web-scraping-best-practices.md) -
  Comprehensive guide to all web scraping best practices, including robots.txt
  compliance, rate limiting, User-Agent policy, HTTP caching, retry logic, and
  kill switch mechanism.

---

## 1. Design Goals

The HTTPX client must be:

- Deterministic
- Anti-bot friendly (no spoofing, no stealth fingerprinting, no rotation)
- Predictable under load
- Resilient to temporary upstream issues
- Observable and debuggable
- Safe to use from ingestion workers, CLI, and dev tooling
- Easy to replace or extend with a browser fallback (Playwright)

The client must provide a stable, uniform interface to all connectors.

---

## 2. Global Rules

### 2.1 One shared HTTPX client per ingestion session

A single shared `AsyncClient` instance must be created per ingestion run.  
Never create clients ad-hoc inside individual scraping functions.

This guarantees:

- consistent headers
- consistent cookies
- consistent connection pooling
- predictable upstream fingerprint
- lower resource usage
- easier debugging

### 2.2 Timeouts

All outbound HTTP requests must use the following timeouts:

- connect: 5 seconds
- read: 20 seconds
- write: 5 seconds
- pool: 5 seconds
- total request hard cap: 30 seconds

Timeouts must be enforced strictly to prevent worker starvation.

### 2.3 Retries

All requests must use a three-level retry policy:

- retry count: 3
- strategy: exponential backoff
- base delay: 0.5 seconds
- jitter: enabled
- retryable failures:
  - connection errors
  - timeouts
  - 5xx upstream errors
  - 429 rate limits (respect Retry-After header)

The client must never retry 4xx errors except 429.

### 2.4 User-Agent

MRE must present a fixed, honest user-agent:
