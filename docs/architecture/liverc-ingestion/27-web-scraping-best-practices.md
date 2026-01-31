---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description:
  Comprehensive web scraping best practices for MRE ingestion subsystem
purpose:
  Defines all web scraping best practices, ethical guidelines, and technical
  requirements for the MRE ingestion subsystem. This document consolidates
  information from multiple architecture documents into a single authoritative
  reference for web scraping practices.
relatedFiles:
  - docs/architecture/liverc-ingestion/02-connector-architecture.md
  - docs/architecture/liverc-ingestion/17-ingestion-security.md
  - docs/architecture/liverc-ingestion/25-httpx-client-architecture.md
  - ingestion/common/site_policy.py
  - ingestion/connectors/liverc/client/httpx_client.py
  - policies/site_policy/policy.json
---

# 27. Web Scraping Best Practices

**Status:** Authoritative  
**Scope:** All web scraping operations in the MRE ingestion subsystem  
**Purpose:** Comprehensive guide to web scraping best practices, ethical
guidelines, and technical requirements.

This document consolidates all web scraping best practices for the MRE ingestion
subsystem. It serves as the single authoritative reference for understanding how
MRE implements ethical, respectful, and compliant web scraping.

---

## 1. Philosophy: Cooperative Polite Scraping

MRE's web scraping philosophy is **cooperative polite scraping**, not evasion of
protections. The goal is to:

- Respect website owners' wishes and technical constraints
- Minimize impact on target servers
- Be transparent about automated access
- Follow industry best practices and standards
- Maintain trust and good relationships with data sources

This strategy is not about _evading protections_, but ensuring _cooperative
polite scraping_.

---

## 2. Robots.txt Compliance

### 2.1 Requirements

MRE **MUST** respect `robots.txt` files for all scraping operations:

- ✅ Check `robots.txt` before each request
- ✅ Honor `Disallow` directives
- ✅ Respect `crawl-delay` directives
- ✅ Use proper User-Agent for robots.txt checks
- ✅ Cache parsed robots.txt files to avoid repeated fetches

### 2.2 Implementation

The site policy system (`ingestion/common/site_policy.py`) implements robots.txt
compliance:

- Uses Python's `robotparser.RobotFileParser` for parsing
- Checks `robots.txt` via `ensure_allowed(url)` before requests
- Raises `RobotsDisallowedError` if a path is disallowed
- Caches parsed robots.txt files per host
- Extracts and respects `crawl-delay` values

### 2.3 Configuration

Robots.txt compliance is controlled per-host in
`policies/site_policy/policy.json`:

```json
{
  "hosts": [
    {
      "pattern": "*.liverc.com",
      "respectRobots": true,
      "crawlDelaySeconds": 1.0
    }
  ]
}
```

If `respectRobots` is `false`, robots.txt checks are bypassed (use with
caution).

---

## 3. Rate Limiting and Throttling

### 3.1 Per-Host Throttling

MRE implements per-host throttling to prevent overloading target servers:

- **Crawl Delay**: Minimum time between requests (default: 1.0 second)
- **Concurrency Limits**: Maximum concurrent requests per host (default: 1)
- **Jitter**: Random variation added to delays to avoid synchronized requests
- **Robots.txt Integration**: Respects `crawl-delay` directives from robots.txt

### 3.2 Implementation Details

The site policy system enforces throttling via:

- Semaphores for concurrency control
- Per-host state tracking (`last_request_ts`)
- Automatic delay calculation based on crawl-delay and robots.txt
- Context manager pattern: `async with site_policy.throttle(url):`

### 3.3 Configuration

Throttling is configured in `policies/site_policy/policy.json`:

```json
{
  "hosts": [
    {
      "pattern": "*.liverc.com",
      "crawlDelaySeconds": 1.0,
      "maxConcurrency": 1
    }
  ]
}
```

### 3.4 Request Patterns

MRE follows natural request patterns:

- Low-frequency ingestion (admin-triggered only)
- No parallel request flooding
- Random delays in cron scripts (`sleep $((RANDOM % 120))`)
- Sequential processing where possible

---

## 4. User-Agent Policy

### 4.1 Honest and Transparent

MRE uses a fixed, honest User-Agent string:

```
MRE-IngestionBot/1.0 (contact: admin@domain.com)
```

**Requirements:**

- ✅ Identifies as a bot
- ✅ Includes contact information
- ✅ No spoofing or deception
- ✅ Consistent across all requests
- ✅ No rotation or randomization

### 4.2 Rationale

An honest User-Agent:

- Avoids hostile anti-bot detection behaviors
- Maintains trust with website owners
- Allows website owners to contact MRE if needed
- Demonstrates good faith and transparency
- Follows industry best practices

### 4.3 Implementation

The User-Agent is defined in:

- `ingestion/common/site_policy.py`: `_USER_AGENT` constant
- `ingestion/connectors/liverc/client/httpx_client.py`: `USER_AGENT` constant
- Used consistently across HTTPX and Playwright clients

---

## 5. HTTP Caching (Conditional Requests)

### 5.1 ETag and Last-Modified Support

MRE implements HTTP caching to reduce unnecessary requests:

- ✅ Sends `If-None-Match` header (ETag)
- ✅ Sends `If-Modified-Since` header (Last-Modified)
- ✅ Honors `304 Not Modified` responses
- ✅ Caches response bodies and headers
- ✅ Reduces bandwidth and server load

### 5.2 Implementation

The site policy system handles conditional requests:

- `build_conditional_headers(url)`: Builds conditional request headers
- `record_success(url, response)`: Caches ETag/Last-Modified from responses
- `maybe_use_cached(url, response)`: Returns cached content on 304 responses
- Per-URL cache storage in `_conditional_cache`

### 5.3 Configuration

Conditional requests are enabled per-host:

```json
{
  "hosts": [
    {
      "pattern": "*.liverc.com",
      "conditionalRequests": true
    }
  ]
}
```

---

## 6. Retry Logic and Error Handling

### 6.1 Retry Policy

MRE implements intelligent retry logic:

- **Retry Count**: Maximum 3 attempts
- **Strategy**: Exponential backoff with jitter
- **Base Delay**: 0.5 seconds
- **Jitter**: Random 0-0.1 seconds added to delays
- **Retry-After**: Respects `Retry-After` header from 429 responses

### 6.2 Retryable Errors

Retries are attempted for:

- ✅ Connection errors
- ✅ Timeouts
- ✅ 5xx server errors
- ✅ 429 rate limit errors (with Retry-After respect)

### 6.3 Non-Retryable Errors

Retries are **NOT** attempted for:

- ❌ 4xx client errors (except 429)
- ❌ Robots.txt disallowed errors
- ❌ Authentication failures

### 6.4 Implementation

Retry logic is implemented in:

- `ingestion/connectors/liverc/client/httpx_client.py`: HTTPX client retry logic
- Exponential backoff: `base_delay * (2 ** attempt) + random.uniform(0, 0.1)`
- Retry-After handling: `site_policy.retry_after_seconds(response)`

---

## 7. Timeout Configuration

### 7.1 Timeout Values

All HTTP requests use strict timeout configuration:

- **Connect**: 5 seconds
- **Read**: 20 seconds
- **Write**: 5 seconds
- **Pool**: 5 seconds
- **Total Request Cap**: 30 seconds

### 7.2 Rationale

Strict timeouts:

- Prevent worker starvation
- Ensure predictable behavior
- Fail fast on network issues
- Prevent hanging requests

### 7.3 Implementation

Timeouts are configured in `ingestion/connectors/liverc/client/httpx_client.py`:

```python
TIMEOUT_CONFIG = httpx.Timeout(
    connect=5.0,
    read=20.0,
    write=5.0,
    pool=5.0,
)
MAX_REQUEST_TIME = 30.0
```

---

## 8. Kill Switch Mechanism

### 8.1 Global Kill Switch

MRE implements a global kill switch to disable all scraping instantly:

- **Environment Variable**: `MRE_SCRAPE_ENABLED`
- **Default**: Enabled (if not set)
- **Enforcement**: All scraping paths check this flag
- **Scope**: Cron, CLI, ingestion API, admin UI

### 8.2 Usage

Disable scraping:

```bash
export MRE_SCRAPE_ENABLED=false
```

Re-enable scraping:

```bash
export MRE_SCRAPE_ENABLED=true
```

### 8.3 Implementation

The site policy system enforces the kill switch:

- `is_enabled()`: Checks environment variable
- `ensure_enabled(source)`: Raises `ScrapingDisabledError` if disabled
- Called before every scraping operation

### 8.4 Use Cases

The kill switch is useful for:

- Emergency shutdowns
- Maintenance windows
- Testing and debugging
- Compliance requirements
- Rate limit violations

---

## 9. Browser Automation Best Practices

### 9.1 Minimize Browser Usage

MRE follows the principle: **Use Playwright only when necessary**

- ✅ Prefer HTTPX for static content
- ✅ Use Playwright only for dynamic/JS-rendered content
- ✅ Avoid browser automation when possible
- ✅ Reduce anti-bot detection risk

### 9.2 Playwright Configuration

When Playwright is used, it follows best practices:

- **Headless Mode**: Always headless (no GUI)
- **Realistic Context**: Standard browser context with realistic User-Agent
- **Selector Waiting**: Waits for specific selectors before extraction
- **Immediate Cleanup**: Closes browser contexts immediately after use
- **No Long-Running Instances**: No persistent browser sessions

### 9.3 Decision Tree

The connector follows this decision tree:

1. **Try HTTPX first**: Check if HTML contains required data
2. **Check for dynamic dependencies**: Missing elements or JS-driven content?
3. **Detect anti-bot protections**: Consistent failures indicate protection
4. **Escalate to Playwright**: Only when HTTPX fails

### 9.4 Operational Rules

Playwright usage must:

- Launch headless Chromium with realistic User-Agent
- Wait for specific selectors before extraction
- Extract final DOM state, never raw content
- Close browser context immediately after scraping
- Not throttle itself (orchestrator handles rate limiting)

---

## 10. Security and Safety

### 10.1 Domain Allowlist

MRE only connects to allowed domains:

- ✅ `*.liverc.com` (all LiveRC subdomains)
- ✅ `localhost` (for testing only)
- ❌ No third-party domains
- ❌ No arbitrary URL scraping

### 10.2 HTTPS Only

All fetches MUST use HTTPS:

- ✅ HTTPS only (no HTTP)
- ✅ No HTTP downgrade
- ✅ No redirect following to non-HTTPS endpoints

### 10.3 Input Validation

All URLs are validated:

- ✅ Constructed internally (not user-provided)
- ✅ Domain validation (must match allowlist)
- ✅ No open redirects
- ✅ No arbitrary URL scraping

### 10.4 Sandbox Requirements

Connector execution is sandboxed:

- ✅ Restricted file system access
- ✅ Restricted network access (allowlist only)
- ✅ No arbitrary shell execution
- ✅ No write access outside cache directories

---

## 11. Site Policy Configuration

### 11.1 Policy File

Site policy is configured in `policies/site_policy/policy.json`:

```json
{
  "killSwitchEnv": "MRE_SCRAPE_ENABLED",
  "hosts": [
    {
      "pattern": "live.liverc.com",
      "crawlDelaySeconds": 1.0,
      "maxConcurrency": 1,
      "respectRobots": true,
      "conditionalRequests": true
    },
    {
      "pattern": "*.liverc.com",
      "crawlDelaySeconds": 1.0,
      "maxConcurrency": 1,
      "respectRobots": true,
      "conditionalRequests": true
    }
  ]
}
```

### 11.2 Configuration Options

- **killSwitchEnv**: Environment variable name for kill switch
- **pattern**: Host pattern (exact match or `*.domain.com` wildcard)
- **crawlDelaySeconds**: Minimum delay between requests
- **maxConcurrency**: Maximum concurrent requests per host
- **respectRobots**: Whether to check robots.txt
- **conditionalRequests**: Whether to use ETag/Last-Modified

### 11.3 Implementation

The site policy is implemented in:

- `ingestion/common/site_policy.py` (Python runtime)
- `src/lib/site-policy.ts` (Next.js runtime - if implemented)

Both implementations must stay in sync.

---

## 12. Observability and Monitoring

### 12.1 Structured Logging

All scraping operations emit structured logs:

- Request attempts and retries
- Robots.txt checks and blocks
- Rate limit hits
- Cache hits/misses
- Throttle delays
- Error conditions

### 12.2 Metrics

The site policy system emits metrics:

- `site_policy_event`: Policy decisions (throttle, cache_hit, block, disabled)
- Host-level metrics for monitoring
- Error rate tracking

### 12.3 Debug Information

Debug information includes:

- URLs being scraped
- Response status codes
- Retry attempts and delays
- Robots.txt decisions
- Cache hit/miss status

---

## 13. Compliance Checklist

When implementing new scraping functionality, ensure:

- [ ] Robots.txt compliance implemented
- [ ] Rate limiting/throttling configured
- [ ] Honest User-Agent set
- [ ] HTTP caching enabled (if supported)
- [ ] Retry logic with exponential backoff
- [ ] Proper timeout configuration
- [ ] Kill switch integration
- [ ] Domain allowlist validation
- [ ] HTTPS only enforcement
- [ ] Structured logging implemented
- [ ] Metrics tracking added
- [ ] Site policy configuration updated

---

## 14. Related Documentation

- [Connector Architecture](02-connector-architecture.md) - Overall connector
  design and anti-bot strategy
- [Ingestion Security](17-ingestion-security.md) - Security model including
  User-Agent policy
- [HTTPX Client Architecture](25-httpx-client-architecture.md) - HTTPX client
  implementation details
- [Site Policy Implementation](../../../ingestion/common/site_policy.py) -
  Python site policy code
- [Site Policy Configuration](../../../policies/site_policy/policy.json) -
  Policy configuration file

---

## 15. Summary

MRE implements comprehensive web scraping best practices:

✅ **Robots.txt Compliance**: Full respect for robots.txt files and crawl-delay
directives  
✅ **Rate Limiting**: Per-host throttling with configurable delays and
concurrency limits  
✅ **Honest User-Agent**: Transparent bot identification with contact
information  
✅ **HTTP Caching**: ETag/Last-Modified support to reduce unnecessary requests  
✅ **Retry Logic**: Intelligent retry with exponential backoff and Retry-After
respect  
✅ **Timeout Configuration**: Strict timeouts to prevent resource exhaustion  
✅ **Kill Switch**: Global kill switch for emergency shutdowns  
✅ **Browser Minimization**: Playwright used only when necessary  
✅ **Security**: Domain allowlist, HTTPS only, input validation  
✅ **Observability**: Structured logging and metrics tracking

All scraping operations follow the principle of **cooperative polite scraping**,
respecting website owners' wishes and technical constraints while maintaining
transparency and trust.

---

## License

Internal use only. This specification governs web scraping practices for MRE.
