---
created: 2026-03-29
owner: Quality / Performance
purpose:
  Evidence-based application performance review: methodology, baselines, static
  analysis findings, and ranked remediation backlog. Anchored on
  docs/architecture/performance-requirements.md and Docker-only measurement.
relatedDocs:
  - docs/architecture/performance-requirements.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/AGENTS.md
---

# Application performance review (March 2026)

**Status:** Complete (static review + partial baselines)  
**Environment:** Measurements taken against Docker Desktop (`mre-app`,
`mre-postgres`, `mre-liverc-ingestion-service`) where noted.

---

## 1. Methodology

1. **Normative criteria** — Findings are classified against
   [performance-requirements.md](../architecture/performance-requirements.md)
   and mobile-safe rules in
   [mobile-safe-architecture-guidelines.md](../architecture/mobile-safe-architecture-guidelines.md)
   (Section 10).
2. **Baselines first** — Unauthenticated HTTP timings where possible;
   authenticated routes require a browser session (document procedure, repeat
   with HAR).
3. **Static code review** — Waves A–D (core/DB, API routes, UI/Redux, ingestion)
   with file references and verification steps.
4. **No production APM** — Relies on DevTools, curl samples,
   structlog/Prometheus on ingestion per
   [15-ingestion-observability.md](../architecture/liverc-ingestion/15-ingestion-observability.md).

---

## 2. Critical user journeys (locked)

| #   | Journey                                          | Primary UI                                                                                                                                                       | Primary APIs / services                                                                                                            |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| J1  | Authenticated dashboard load and event selection | [eventAnalysis/page.tsx](<../../src/app/(authenticated)/eventAnalysis/page.tsx>)                                                                                 | `GET /api/v1/events`, `GET /api/v1/events/:id/summary`                                                                             |
| J2  | Event analysis (tabs, charts, tables)            | [EventAnalysisSection.tsx](../../src/components/organisms/dashboard/EventAnalysisSection.tsx), [event-analysis/](../../src/components/organisms/event-analysis/) | `GET /api/v1/events/:id/analysis`, `GET /api/v1/events/:id/venue-correction`                                                       |
| J3  | Unified / event / practice-day search            | Search UI                                                                                                                                                        | [search/route.ts](../../src/app/api/v1/search/route.ts), `events/search`, `practice-days/search`                                   |
| J4  | (Optional) Ingestion trigger + job status        | Admin / import flows                                                                                                                                             | `POST /api/v1/events/:id/ingest`, `GET /api/v1/ingestion/jobs/:jobId`, Python [pipeline.py](../../ingestion/ingestion/pipeline.py) |

---

## 3. Success criteria (from performance requirements)

**Page (UX)**

- First Contentful Paint &lt; 2s; TTI &lt; 3s; LCP &lt; 2.5s.

**API (p95)**

- Health &lt; 100ms; auth &lt; 500ms; data endpoints &lt; 1s; complex &lt; 2s.
- Endpoint table: see
  [performance-requirements.md § API Response Time Targets](../architecture/performance-requirements.md#api-response-time-targets).

**Payload bands**

- Small &lt; 10KB, medium &lt; 100KB, large &lt; 1MB (with pagination).

**Database (p95)**

- Simple &lt; 50ms, joins &lt; 200ms, complex aggregations &lt; 500ms.

**Finding severity**

- **Fail** — Exceeds documented budget or likely to on realistic data.
- **Risk** — Depends on event size; needs measurement.
- **Pass** — Meets or aligned with budgets / acceptable tradeoffs.

---

## 4. Baseline appendix

### 4.1 HTTP samples (host → `localhost:3001`, 2026-03-29)

| Route                        | Samples (s)                           | Notes                                                                        |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/v1/health`         | 0.007, 0.014, 0.061, 0.067, **0.281** | Mostly within 100ms target; one cold/warm outlier still &lt; 300ms.          |
| `GET /api/v1/tracks?limit=5` | 0.016, **0.309**, **1.835**           | High variance; warrants p95 measurement under load and with full track list. |

**Authenticated routes** (`/api/v1/events/:id/summary`, `/analysis`, `/search`):
not timed here (require session cookie). **Procedure:** log in via browser,
DevTools Network, export HAR or script `curl` with `Cookie:`; repeat ≥10 calls
per route for p95.

### 4.2 Production build / bundle

`docker exec mre-app npm run build` was executed. **TypeScript check failed**
before route bundle summary:

- `src/components/organisms/dashboard/EventAnalysisSection.tsx` — transformed
  `races` missing `raceUrl` required by `EventAnalysisData` type.

Until the build is green, **Next.js route bundle sizes were not captured**.
Recommended follow-up: fix the type/shape alignment, re-run build, and paste the
“First Load JS” table into this appendix. Compare against the &lt; 200KB gzipped
JS **recommendation** in
[performance-requirements.md](../architecture/performance-requirements.md)
(still marked placeholder).

### 4.3 Ingestion observability

Ingestion aligns with documented patterns: `TraceSpan`,
`metrics.IngestionDurationTracker`, `observe_race_fetch`,
`record_practice_day_ingestion`, entry cache hit/miss metrics in
[pipeline.py](../../ingestion/ingestion/pipeline.py). **Baseline:** correlate
one full event ingest with structlog stage fields from
[15-ingestion-observability.md](../architecture/liverc-ingestion/15-ingestion-observability.md)
and Prometheus scrape (if enabled in your compose).

---

## 5. Wave A — Core / database (`get-event-analysis-data`, summary path)

| ID  | Severity | Finding                                                                                                                                                                                                                                                          | Evidence / verification                                                                                                                                                                                                                                                              |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Risk** | `getEventAnalysisData` loads the full event graph: all races, all results, **all laps per result** (ordered), then strips laps from the JSON response. DB and Node still pay the cost of hydrating every lap row.                                                | [get-event-analysis-data.ts](../../src/core/events/get-event-analysis-data.ts) (`findUnique` `include` → `laps`); comment ~1307 notes payload reduction but query shape remains heavy. **Verify:** large event (many races × drivers × laps) with Prisma query logging or `EXPLAIN`. |
| A2  | **Risk** | Same handler runs additional queries after the tree load: `lap.count`, `eventEntry.findMany`, `eventRaceClass.findMany`, venue correction + optional `track.findUnique`.                                                                                         | Lines ~1171, ~1360, ~1374, ~1447–1450. **Verify:** total round-trips and time per request.                                                                                                                                                                                           |
| A3  | **Risk** | `getEventSummary` issues **sequential** queries (`event`, `race.aggregate`, `groupBy`, `lap.aggregate`, then **three** separate `raceResult.findMany` for fast lap / consistency / avg lap).                                                                     | [get-event-analysis-data.ts](../../src/core/events/get-event-analysis-data.ts) ~420–716. **Mitigation:** `Promise.all` where independent; or consolidate with narrower selects / SQL views if profiles show contention.                                                              |
| A4  | **Risk** | With `userId`, summary path adds `eventDriverLink` and multiple `raceResult.findMany` branches for user-specific rankings.                                                                                                                                       | ~738–950 region. **Verify:** one DB round-trip count per summary request with user link present.                                                                                                                                                                                     |
| A5  | **Pass** | `calculateMostImprovedDrivers` uses a single `raceResult.findMany` with includes; in-memory grouping. Reasonable for bounded event size per [13-ingestion-performance-and-scaling.md](../architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md). | [calculate-driver-improvement.ts](../../src/core/events/calculate-driver-improvement.ts)                                                                                                                                                                                             |

---

## 6. Wave B — API routes

| ID  | Severity | Finding                                                                                                                                                                                                          | Evidence / verification                                                                                                                                                                    |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | **Pass** | Analysis route delegates to core and serializes Maps; thin handler.                                                                                                                                              | [analysis/route.ts](../../src/app/api/v1/events/[eventId]/analysis/route.ts)                                                                                                               |
| B2  | **Risk** | Unified search delegates to `unifiedSearch`; complexity depends on [core/search](../../src/core/search/). Treat as hot path for J3; profile with realistic `q` and date ranges.                                  | [search/route.ts](../../src/app/api/v1/search/route.ts)                                                                                                                                    |
| B3  | **Risk** | `withPerformanceLogging` from [api-performance-wrapper.ts](../../src/lib/api-performance-wrapper.ts) is **not imported** by route handlers (wrapper exists but is unused). Slow requests rely on ad hoc logging. | Repo-wide: no consumers besides the wrapper file. **Remediation:** pilot on `GET .../analysis`, `GET .../summary`, `GET /api/v1/search` or add timing to `createRequestLogger` completion. |
| B4  | **Pass** | [performance-logger.ts](../../src/lib/performance-logger.ts) thresholds available for slow-query / slow-request logging if wired.                                                                                | Integrate with hottest handlers after A1 optimization.                                                                                                                                     |

---

## 7. Wave C — UI / Redux

| ID  | Severity | Finding                                                                                                                                                                                      | Evidence / verification                                                                                                                                                                                                                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Risk** | Selecting an event triggers **venue-correction fetch** and **analysis fetch**; successful correction path dispatches `fetchEventAnalysisData` again (duplicate full analysis load).          | [EventAnalysisSection.tsx](../../src/components/organisms/dashboard/EventAnalysisSection.tsx) `fetchVenueCorrection` + `handleVenueCorrectionSuccess`. **Mitigation:** debounce or skip second fetch if first response already includes corrected venue; or merge endpoints. |
| C2  | **Risk** | Analysis fetch uses **50ms `setTimeout`** before dispatch; adds latency and complicates reasoning.                                                                                           | Same file ~303–315. Prefer dispatch in `useEffect` without delay unless blocking a proven race.                                                                                                                                                                              |
| C3  | **Pass** | `fetchEventAnalysisData` / `fetchEventData` use `cache: "no-store"` and AbortSignal — appropriate for fresh dashboard data; stale-response guard on summary via `currentFetchRequestId`.     | [dashboardSlice.ts](../../src/store/slices/dashboardSlice.ts)                                                                                                                                                                                                                |
| C4  | **Risk** | Full `analysisData` in Redux drives large tab trees (charts, tables). **Verify:** React Profiler on tab switch for unnecessary re-renders; memoize heavy children where profiler shows cost. | [event-analysis/](../../src/components/organisms/event-analysis/)                                                                                                                                                                                                            |
| C5  | **Note** | `console.warn` in server-side `get-event-analysis-data` for name fallbacks may spam logs under load.                                                                                         | [get-event-analysis-data.ts](../../src/core/events/get-event-analysis-data.ts) ~1218–1258                                                                                                                                                                                    |

---

## 8. Wave D — Ingestion (Python)

| ID  | Severity | Finding                                                                                                                                                                                                                           | Evidence / verification                                               |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D1  | **Pass** | Pipeline uses adaptive race-fetch concurrency, `TraceSpan`, and `IngestionDurationTracker` — consistent with [13-ingestion-performance-and-scaling.md](../architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md). | [pipeline.py](../../ingestion/ingestion/pipeline.py)                  |
| D2  | **Pass** | Entry list cache metrics (`record_event_entry_cache_hit` / lookup) support bottleneck analysis.                                                                                                                                   | pipeline.py ~757–759                                                  |
| D3  | **Risk** | Large `pipeline.py` (~2.4k lines) increases review cost; performance regressions need targeted benchmarks (fixture replay + timing).                                                                                              | Prefer timing sections around Playwright vs HTTPX paths per doc §2.1. |

---

## 9. Ranked remediation backlog

**Detailed implementation plan:**
[application-performance-remediation-2026-03.md](../implimentation_plans/application-performance-remediation-2026-03.md)
(work packages P0–P7, dependencies, acceptance criteria, PR sequencing).

| Rank | Item                                                                                                        | Waves    | Impact                                          | Effort | Next step                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| P0   | Fix `EventAnalysisSection` / `EventAnalysisData` shape so **`next build` succeeds**; capture bundle table   | Baseline | Unblocks CI and bundle budgeting                | Low    | Add `raceUrl` (and any other missing fields) to API response type + transform |
| P1   | Reduce lap hydration in `getEventAnalysisData` (aggregate in DB or fetch laps only when aggregates missing) | A1       | Large drop in DB time and memory for big events | High   | Spike: query without `laps` include + fallback path for sparse aggregates     |
| P2   | Parallelize independent Prisma calls in `getEventSummary`                                                   | A3       | Lower p95 for summary API                       | Medium | `Promise.all` for aggregates + first `findMany` batch                         |
| P3   | Avoid double `fetchEventAnalysisData` on venue correction success path                                      | C1       | Cuts duplicate analysis payload work            | Low    | Single fetch after correction or invalidate selectively                       |
| P4   | Remove or justify 50ms delay before analysis dispatch                                                       | C2       | Slightly faster time-to-data                    | Low    | Remove timeout; test race conditions                                          |
| P5   | Wire `withPerformanceLogging` or request-duration field on 2–3 hot routes                                   | B3       | Observable p95 in logs                          | Low    | analysis, summary, search                                                     |
| P6   | Profile J3 `unifiedSearch` and add DB indexes if slow queries appear                                        | B2       | Search p95                                      | Medium | EXPLAIN + [schema.md](../database/schema.md)                                  |
| P7   | React Profiler pass on event-analysis tabs; memoize hotspots                                                | C4       | Smoother tab switches                           | Medium | Profiler recordings as evidence                                               |

---

## 10. performance-requirements.md

No edits were made: frontend bundle and load-test sections remain
**placeholders**. **Recommendation:** after P0, paste measured bundle sizes and
one authenticated API p95 table into
[performance-requirements.md](../architecture/performance-requirements.md) §
Performance Budgets / Load Testing.

---

## 11. Review completion checklist

- [x] Journeys and criteria locked (§2–3)
- [x] Partial baselines recorded (§4); authenticated + bundle follow-up noted
- [x] Waves A–D documented (§5–8)
- [x] Ranked backlog (§9)
- [x] Linked from [document index](../index/document-index.md)
