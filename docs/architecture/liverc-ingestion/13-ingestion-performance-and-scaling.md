---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Performance model and scaling strategies for LiveRC ingestion
purpose:
  Defines performance model, throughput expectations, scaling strategies, and
  architectural invariants for the LiveRC ingestion subsystem. Focuses on
  efficient on-demand ingestion rather than high-volume scraping.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 13. Ingestion Performance and Scaling (LiveRC Ingestion Subsystem)

This document defines the performance model, throughput expectations, scaling
strategies, and architectural invariants that govern the LiveRC ingestion
subsystem in My Race Engineer (MRE). The goal is not high-volume scraping, but
**low-frequency, high-integrity ingestion** that remains predictable,
resource-efficient, and future-proof as the system grows to support multiple
connectors and multiple ingestion depths.

This document guides backend implementation, operational deployment, and future
optimisation.

---

## 1. Core Performance Principles

MRE ingestion is designed around the following principles:

1. **Correctness and determinism first, performance second.**  
   Ingestion MUST always maintain data integrity even if it runs slower.

2. **Low QPS, high confidence.**  
   The ingestion workload is intentionally small:
   - Admin-triggered
   - Event-specific
   - No continuous polling
   - No automatic scraping of high-volume pages

3. **Bounded work per event.**  
   A typical event contains:
   - 5 to 15 races
   - 6 to 12 drivers per race
   - 30 to 45 laps per driver  
     Total: ~1,000 to ~5,000 lap rows (light workload)

4. **Horizontal concurrency without contention.**  
   MRE may ingest multiple separate events concurrently, but MUST:
   - acquire event-level locks
   - avoid overloading LiveRC

5. **Browser usage kept minimal.**  
   Most pages use HTTPX. Only one page per race uses Playwright.

---

## 2. Expected Throughput

### 2.1 Event Ingestion Time

Typical ingestion duration (guidelines):

- Event summary page: < 200 ms
- 10 race pages via HTTPX: 300–800 ms
- Playwright-enabled lap extraction: 400–1,500 ms total per race depending on JS
  load
- Normalisation and DB persistence: 200–500 ms

**Total estimated ingestion time:**  
**2–10 seconds** for a complete event.

This is acceptable because ingestion is admin-triggered and infrequent.

### 2.2 Volume Expectations

Even busy clubs generate:

- ~30–50 events per year
- maybe 200–400 races total
- ~40k–150k laps per year

MRE can easily handle this volume even on a modest server.

---

## 3. Scaling Dimensions

### 3.1 CPU Scaling

Most ingestion CPU time is spent:

1. Parsing HTML
2. Running JavaScript in Playwright
3. Normalising lap series

Opportunities to scale:

- Parallel ingestion of _different_ events
- Parallel fetch of races within the same event (optional future optimisation)

### 3.2 Memory Scaling

Memory consumption is low:

- HTML content per page: < 500 KB
- Parsed event data: < 1–5 MB
- Playwright browser: 150–300 MB per context

The connector MUST open and close Playwright contexts quickly to avoid memory
buildup.

### 3.3 Database Scaling

DB write volume per event:

- ~10 races
- ~100 race results
- ~1,000–5,000 lap rows

This is trivial for PostgreSQL.

Indexes required:

- race(event_id)
- race_result(race_id)
- lap(race_result_id)
- source\_\* identifiers for idempotency

---

## 4. Concurrency and Locking Strategy

### 4.1 Event-Level Mutex

Ingestion MUST acquire a DB advisory lock:

- Scope: event_id
- Purpose: prevent two ingestions of the same event running concurrently
- No global lock is needed

### 4.2 Connector-Level Throttle

Connector MUST:

- limit Playwright usage to one page at a time per event
- optionally allow multiple HTTPX fetches in parallel
- apply exponential backoff when failing

### 4.3 System-Wide Isolation

It is safe to ingest:

- multiple tracks concurrently
- multiple events concurrently
- multiple race pages concurrently _only if we later add parallelism_

---

## 5. Performance Optimisation Levers

### 5.1 Connection Pool Tuning

PostgreSQL connection pool:

- recommended: 10–20 connections
- ingestion uses 1–3 connections per event

### 5.2 Parallel Race Fetching (Future Optimisation)

While V1 ingestion is strictly sequential for simplicity, future versions MAY:

- fetch race pages in parallel using async HTTPX
- but persist them sequentially to maintain deterministic ordering

### 5.3 Pre-Caching Event Summary

If an event is viewed frequently:

- event summary can be cached
- race metadata can be cached separately
- lap series SHOULD NOT be cached (large payload)

Caching MUST NOT break determinism.

---

## 6. Playwright Performance Considerations

Playwright is the most expensive component of ingestion.

Rules:

1. Use Playwright only when lap tables require JS expansion.
2. Close browser contexts immediately after use.
3. Avoid multi-page navigation in a single context.
4. Avoid screenshots unless debugging.
5. Consider headless mode always enabled.

Expected overhead per race:  
**150–600 ms** depending on JS complexity.

---

## 7. Network Considerations

### 7.1 Latency

Since LiveRC servers are located in the USA, Australian latency is expected:

- Round-trip: 200–300 ms typical
- Multi-fetch scenarios: 2–5 seconds total

### 7.2 Retries

HTTPX and Playwright MUST use:

- retry with backoff
- max retry count per page
- circuit breaking when LiveRC is unreachable

Retries MUST NOT exceed reasonable timeouts (debug mode may override).

---

## 8. DB Write Optimisation

### 8.1 Batched Inserts

For lap data:

- Use batched inserts rather than row-by-row writes
- Avoid ORM overhead if possible
- Ensure upsert strategy remains idempotent

Batch size: 500–2,000 rows per write depending on DB configuration.

### 8.2 Idempotent Upsert Rules

Upserts MUST:

- match rows by source identifier (race ID, driver ID, lap number)
- avoid duplicate writes
- avoid UPDATE storms (only update when values changed)

---

## 9. Scaling Beyond LiveRC

The ingestion subsystem MUST support future connectors such as:

- RC Scoring Pro
- MyRCM
- proprietary club timing systems

Design considerations:

- connector layer is pluggable
- ingestion pipeline is source-agnostic
- DB model can represent multi-source data
- ingestion depth can vary per source

This requires no change to performance architecture.

---

## 10. Operational Guidelines

### 10.1 Cron-Triggered Ingestion (Optional Future)

If clubs adopt automated ingestion:

- limit cron frequency to avoid load spikes
- maintain event-level locking
- track ingestion duration and failure patterns

### 10.2 Production Monitoring

The system MUST track:

- ingestion duration per event
- number of races and laps processed
- error rate per page type
- Playwright failures
- connector retry counts

These metrics are essential for scaling analysis.

### 10.3 Local Development

Developers SHOULD use:

- local fixture HTML snapshots
- mock Playwright contexts
- dry-run ingestion without DB writes

This avoids slow, expensive real-world scraping during development.

---

## 11. Future Extensions

Possible enhancements:

1. Distributed scraping workers
2. Browserless rendering for predictable DOM extraction
3. Incremental ingestion (partial race updates)
4. Race result diffing (detecting upstream corrections)
5. GPU-accelerated or parallel HTML parsing

These MUST NOT compromise correctness or determinism.

---

End of 13-ingestion-performance-and-scaling.md.
