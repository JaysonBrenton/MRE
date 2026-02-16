# Practice Day Search Performance — Design Document

**Status:** Implemented  
**Last updated:** 2026-02-15  
**Scope:** Practice day discovery performance; design options and implemented improvements.  
**Do not touch:** Search performance improvements have already been implemented. Do not modify this area—no further changes to discover-range, cache, client discover flow, Python practice discover, or related code.

**Related:** [Event Search: Include Practice Days](event-search-include-practice-days-design.md), [Practice Day Search Performance Review](../reviews/Old/2026-02-14-practice-day-search-performance.md)

---

## Implementation status (2026-02-15)

Performance improvements have been implemented. Practice day search is now **significantly faster** in normal use:

- **Single request:** Client calls `POST /api/v1/practice-days/discover-range` once (no per-month browser requests). Server fans out to Python per month internally.
- **Cache:** Python ingestion caches results per (track_slug, year, month) with configurable TTL (default 10 min). API route returns cached data immediately when available. **Repeat searches for the same track/range are sub-second** (e.g. ~50–150 ms for discover-range when cache is warm).
- **Timeouts:** Month-view and per-day fetches have timeouts (configurable) so one slow page does not block the whole discover.
- **Streaming:** Optional `stream: true` returns NDJSON; client can show partial results as each month completes.
- **Default range:** When no practice range is available, default is **180 days** (not 12 months); discover is still capped at 12 months max.
- **Skip when covered:** Client skips LiveRC discovery when DB already has practice days covering the requested range.
- **Optimistic update:** After importing a practice day, the list updates without refetching the full search.

See **Section 13** for before/after timings (Canberra track).

---

## 1. Overview

### 1.1 Purpose

When Event Search is used with **Include practice days** enabled, users see a combined list of events and practice days (ingested + discovered from LiveRC). The **event search** path is fast (single API call, DB-only). **Practice day discovery** now uses a single discover-range request (or streaming), server-side cache, and a 180-day default range; repeat searches within the cache TTL are fast (tens to low hundreds of ms). This document describes the architecture, root causes that were addressed, and the design options that were implemented.

### 1.2 Goals

- **Align perceived performance:** Users should not experience a large gap between “search without practice days” and “search with practice days.”
- **Reduce latency and request volume:** Fewer round trips and less redundant work (e.g. skip discovery when DB already covers the range).
- **Improve perceived responsiveness:** Show partial results as they arrive where possible; avoid blocking the UI on the slowest month.
- **Preserve correctness:** No change to data semantics, import flow, or existing API contracts beyond additive or optional behaviour.

### 1.3 Non-goals

- Changing the standalone Practice Days search (track + month picker) flow.
- **Changing Event Search or its contents:** Do not touch the Event Search modal, search filters, or any practice-day features or code inside Event Search. No UI or frontend changes to that flow.
- **Changing practice-day search performance:** Search performance improvements have already been implemented. Do not touch discover-range, cache, client discover flow, Python practice discover, or any related performance code.
- Redesigning the Event Search page layout or the combined list UX (beyond loading/progress behaviour).
- Replacing the Python ingestion service or LiveRC connector architecture.

---

## 2. Current Architecture and Data Flow

### 2.1 Event search (fast path)

| Step | Location | Action |
|------|----------|--------|
| 1 | Browser | `GET /api/v1/events/search?track_id=…&include_practice_days=true` (optional `start_date`, `end_date`) |
| 2 | Next.js API | Auth, validate `track_id`. |
| 3 | Core | `searchEvents(input)` runs **in parallel**: `searchEventsFromRepo(params)` and `searchPracticeDayEventsFromRepo(params)` (Prisma only). |
| 4 | Response | `track`, `events`, `practice_days` (ingested), `practice_range_min`, `practice_range_max`. |

**Characteristics:** One HTTP request, two parallel Prisma queries, no external service. Response time is dominated by DB latency (typically tens to low hundreds of milliseconds).

### 2.2 Practice day discovery (current path — implemented improvements)

After the event search response arrives, the client runs **practice discover** in the background.

| Step | Location | Action |
|------|----------|--------|
| 1 | Client | Compute practice range: `practiceRangeMin` / `practiceRangeMax` from response, or **default last 180 days** when both null. Skip discovery entirely if DB already covers the range. |
| 2 | Client | **Single request:** `POST /api/v1/practice-days/discover-range` with `{ track_id, track_slug?, start_date, end_date }` and optional `stream: true` for partial results. |
| 3 | Next.js | Auth, validate. Server computes months (capped at 12), calls Python per month (or streams NDJSON as each month completes). Returns summary-only payload (sessions stripped). |
| 4 | Python ingestion | **Cache check:** If (track_slug, year, month) is cached and within TTL, return immediately. Otherwise scrape LiveRC with **timeouts** (month view 15 s, day overview 25 s) and bounded concurrency (10). Cache result. |
| 5 | Client | Merges `practice_days`; filters out dates already in `practiceDaysFromDb`. When streaming, `onStreamMonth` updates the list as each month completes. |

**Constants (current):**

- `DISCOVER_RANGE_MONTHS_CAP = 12` (max months requested)
- Default range when no data: **last 180 days** from today
- Python: `PRACTICE_DISCOVER_CACHE_TTL_SECONDS` (default 600), `PRACTICE_DISCOVER_MONTH_VIEW_TIMEOUT_SECONDS` (15), `PRACTICE_DISCOVER_DAY_OVERVIEW_TIMEOUT_SECONDS` (25)
- Client: `PRACTICE_DISCOVER_FETCH_MS = 20_000` for discover-range timeout

**Characteristics:** One HTTP request from browser (or streaming). Server-side cache makes repeat searches for the same track/range fast (tens to low hundreds of ms). First run (cold) still depends on LiveRC latency; timeouts prevent runaway. Summary-only responses reduce payload size.

### 2.3 Key code references

| Concern | File / area |
|--------|--------------|
| Event search API | `src/app/api/v1/events/search/route.ts` |
| Event search core | `src/core/events/search-events.ts`, `src/core/events/repo.ts` |
| Practice discover API | `src/app/api/v1/practice-days/discover/route.ts` |
| Practice discover core | `src/core/practice-days/discover-practice-days.ts` (Next.js → Python fetch; Prisma `getTrackById` here) |
| Client discover loop | `EventSearchContainer.tsx`: `getMonthsBetween`, `discoverPracticeDaysInRange`, batches of 6, `setDiscoveredPracticeDays` after all settled |
| Python discover | `ingestion/api/routes.py` `discover_practice_days_endpoint`; `ingestion/services/practice_day_discovery.py` |
| List row (summary only) | `PracticeDayRow.tsx`: uses `sessionCount`, `totalLaps`, `uniqueDrivers`, `uniqueClasses`, `timeRangeStart`, `timeRangeEnd` |

---

## 3. Root Cause Analysis

### 3.1 Latency drivers

| Cause | Impact |
|-------|--------|
| **Multiple round trips** | 12 requests × (browser RTT + Next.js + Prisma + Python + LiveRC). Slowest batch gates the next; two batches of 6 → at least 2 × (slowest of 6) before any discovery UI update. |
| **Per-request Prisma lookup** | Each `POST /practice-days/discover` triggers `getTrackById(track_id)` in Next.js to get `sourceTrackSlug`. Redundant when the client already has track from the event search response. |
| **LiveRC scraping** | Each month requires the Python service to hit LiveRC (often multiple pages). External dependency; latency and failure rate are outside our control. |
| **No short-circuit** | Discovery is always run for the full range. If the DB already has ingested practice days covering that range, we still perform up to 12 LiveRC scrapes and then deduplicate client-side. |
| **Default range (was 12 months; now 180 days)** | When there are no events and no date filter, the client defaults to last 180 days (implemented); discover is capped at 12 months. |

### 3.2 Payload and rendering

| Cause | Impact |
|-------|--------|
| **Full session detail in response** | Each practice day in the discover response includes a `sessions` array (driver, laps, URLs, etc.). The list view only needs aggregates. Large payloads (hundreds of KB per month × 12) increase transfer and parse time. |
| **End-of-run rendering** | `setDiscoveredPracticeDays` is called only after every month request has settled. Users see no discovered rows until the full batch completes. |
| **No cancellation** | A new search or toggling “Include practice days” off does not abort in-flight discover requests; they run to completion or timeout. |

### 3.3 Post-import re-fetch

| Cause | Impact |
|-------|--------|
| **Full search after each import** | After importing a discovered practice day, the client calls `GET /api/v1/events/search?include_practice_days=true` again to refresh `practiceDaysFromDb`. This re-runs the full search and can trigger another full discover cycle. |

---

## 4. Cross-Cutting Tactics (Applicable to Multiple Options)

The following tactics can be combined with any of the main options below.

### 4.1 Pass `track_slug` from client

- **What:** When the client already has the track (from the event search response), send `track_slug` (or `source_track_slug`) in the discover request so the server does not need to call `getTrackById(track_id)`.
- **Where:** Next.js discover route (and any new discover-range route). Validate that `track_id` matches the known track when `track_slug` is provided, or require both for consistency.
- **Benefit:** Saves one Prisma read per discover request (or per range request). Low implementation cost.

### 4.2 Summary-only discovery payload

- **What:** Discovery API returns only the fields needed for the list: `date`, `track_slug`, `session_count`, `total_laps`, `total_track_time_seconds`, `unique_drivers`, `unique_classes`, `time_range_start`, `time_range_end`. Omit `sessions` unless explicitly requested (e.g. `?detail=full` or a separate “get practice day detail” endpoint).
- **Where:** Python ingestion `discover_practice_days_endpoint` (and any range variant). Optionally strip in Next.js if Python cannot be changed immediately.
- **Benefit:** Smaller responses, faster transfer and parse. Reduces bandwidth and memory on client and server.

### 4.3 Skip discovery when DB covers range

- **What:** Before issuing discover requests, compare the requested range to the set of ingested practice dates. If for every month in the range we already have at least one ingested practice day (or a heuristic: min(ingested dates) ≤ range_min and max(ingested dates) ≥ range_max), skip LiveRC discovery entirely.
- **Where:** Client (compare `practiceDaysFromDb` dates to `practiceRangeMin/Max`) or server (client sends ingested dates or range, server decides). Server-side skip requires the API to accept “already have these dates” or to query DB for ingested range.
- **Benefit:** Zero LiveRC calls when the user is re-viewing a range that is already fully ingested. Large win for repeat searches.

### 4.4 Smaller default range

- **What:** When `practice_range_min` and `practice_range_max` are both null, use a default range of e.g. **180 days** (or “current half-year”) instead of 12 months.
- **Where:** Client: `discoverPracticeDaysInRange` default range calculation.
- **Benefit:** Fewer months → fewer requests when the DB is empty. Can be combined with “Search last year” as an explicit user action.

### 4.5 Abort in-flight discovery

- **What:** Maintain a single `AbortController` for the current discover run. When the user starts a new search or turns “Include practice days” off, call `controller.abort()` and pass the signal to every `fetch` in `discoverPracticeDaysInRange`.
- **Where:** Client: `EventSearchContainer`, `discoverPracticeDaysInRange`.
- **Benefit:** Stops wasted work and bandwidth when the user has moved on; avoids stale results overwriting state.

### 4.6 Optimistic update after import

- **What:** When a discovered practice day is successfully imported, optimistically add that date to `practiceDaysFromDb` (synthetic row or minimal fields) and remove it from `discoveredPracticeDays`, instead of calling `GET /api/v1/events/search?include_practice_days=true` to refresh.
- **Where:** Client: handler that runs after `POST /api/v1/practice-days/ingest` succeeds. The ingest API already returns the created event id; use it to build the minimal row.
- **Benefit:** No second full search + possible discover cycle after each import; instant UI update.

---

## 5. Option A — Consolidated Range API (Server-Side Fan-Out, Single Client Request)

### 5.1 Description

Replace the N separate `POST /api/v1/practice-days/discover` calls (one per month) with a **single** client request to a new endpoint that accepts a date range (or list of months). The server (Next.js and/or Python) is responsible for chunking the range into months, calling the existing discovery logic per month (with bounded parallelism), and returning one merged response. Optionally support streaming (chunked JSON or SSE) so the client can render partial results.

### 5.2 Data flow

1. Client: After event search returns, call **once** `POST /api/v1/practice-days/discover-range` with body e.g. `{ track_id, track_slug?, start_date, end_date }` (or `{ track_id, months: [{ year, month }, …] }`).
2. Next.js: Validate, optionally resolve track if `track_slug` not provided. Compute months in range (cap at 12 or configurable). Option A1: Next.js calls Python **once** with the full month list; Python loops internally. Option A2: Next.js loops over months, calls existing Python per-month endpoint internally, merges results.
3. Python (if A1): New endpoint e.g. `POST /api/v1/practice-days/discover-range` accepting `{ track_slug, months: [{ year, month }, …] }`; loops over months (sequential or bounded parallel), calls existing `discover_practice_days` per month, returns `{ practice_days: [...] }` with summaries only (no `sessions` unless requested).
4. Next.js: Return merged list to client (or stream chunks per month).
5. Client: Single response handler; merge into `discoveredPracticeDays`, deduplicate against `practiceDaysFromDb`.

### 5.3 API contract (example)

**Request**

```http
POST /api/v1/practice-days/discover-range
Content-Type: application/json

{
  "track_id": "uuid",
  "track_slug": "canberra-off-road",  // optional; if present, server may skip Prisma lookup
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
```

Alternative: client sends `months: [{ year: 2025, month: 1 }, ...]` to avoid server recomputing.

**Response (non-streaming)**

```json
{
  "success": true,
  "data": {
    "practice_days": [
      {
        "date": "2025-06-15",
        "track_slug": "canberra-off-road",
        "session_count": 4,
        "total_laps": 120,
        "unique_drivers": 3,
        "unique_classes": 2,
        "time_range_start": "09:00",
        "time_range_end": "12:30"
      }
    ],
    "months_queried": 12
  }
}
```

**Response (streaming variant)**  
Chunked transfer or SSE: each chunk is a JSON object with e.g. `{ month: { year, month }, practice_days: [...] }`. Client appends to local list as chunks arrive.

### 5.4 Implementation notes

- **Next.js:** New route `src/app/api/v1/practice-days/discover-range/route.ts`. Validate `start_date`/`end_date`, compute months (reuse logic from client or shared util), cap at 12. If Python has a range endpoint: one internal fetch to Python with `months`. If not: loop with bounded concurrency (e.g. `p-limit` or 6 at a time), call existing `discoverPracticeDays` per month, merge; strip `sessions` from each item before merging.
- **Python (optional):** New route that accepts `months`, loops (bounded parallel with semaphore), returns merged summary-only list. Respect existing “max 3 months per scrape” if any; if so, chunk into groups of 3 and run sequentially per group.
- **Client:** Replace the loop in `discoverPracticeDaysInRange` with a single `fetch` to `discover-range`. Pass `track_slug` from event search response. On response, set `discoveredPracticeDays` and filter by ingested dates as today.
- **Streaming:** If Next.js streams, use `ReadableStream` or SSE; client subscribes and calls `setDiscoveredPracticeDays(prev => merge(prev, chunk.practice_days))` per chunk. Requires ingestion to support streaming (e.g. Python yields chunks) or Next.js to buffer and stream as each month completes.

### 5.5 Pros and cons

| Pros | Cons |
|------|------|
| One round trip from browser; RTT and connection overhead minimized | Requires new endpoint(s) and coordination between Next.js and Python |
| Server can run months in parallel without exposing 12 requests to the client | Without streaming, client still waits for full range to complete |
| Easier to add caching (e.g. Redis) keyed by `(track_id, start_date, end_date)` or per month | Streaming adds complexity (chunked encoding, error handling, backpressure) |
| Client code simplifies (no batching loop, no per-month timeout wiring) | Python may need a new endpoint and internal loop |

### 5.6 Effort and risk

- **Effort:** Medium–high. Next.js route + client change: small–medium. Python range endpoint + summary-only: medium. Streaming: additional medium.
- **Risks:** Backend becomes single point of long-running request; need timeouts and cancellation (e.g. client disconnect). If Python range endpoint is not added, Next.js must do 12 internal fetches to Python; still one client round trip but server holds connection open.

---

## 6. Option B — Server-Fanned Fan-Out (No New Python Endpoint)

### 6.1 Description

Keep the existing Python **per-month** discover endpoint unchanged. Add a **Next.js-only** “discover-range” route that computes the month list, calls the existing Python endpoint once per month from the server (with bounded concurrency), merges and trims responses (e.g. strip `sessions`), and returns a single response to the client. The browser still makes one request; the server does the fan-out internally.

### 6.2 Data flow

1. Client: Single `POST /api/v1/practice-days/discover-range` with `track_id`, `track_slug?`, `start_date`, `end_date` (or `months`).
2. Next.js: Auth, validate. Resolve track for `track_slug` if not provided. Compute months (capped). Loop: for each month, call `discoverPracticeDays({ trackId, year, month })` (existing core that fetches Python). Run with concurrency limit (e.g. 6). Merge all `practiceDays`; optionally strip `sessions` from each item. Return merged list.
3. Client: One response; set `discoveredPracticeDays`, deduplicate vs ingested.

### 6.3 API contract

Same as Option A request/response; no streaming in the minimal form. Response is the full merged list after all months complete.

### 6.4 Implementation notes

- **Next.js:** New route. Use a shared `getMonthsBetween` (or port from client). `Promise.all` in chunks of 6 over months; `Promise.allSettled` to tolerate per-month failures. Merge arrays; remove `sessions` from each practice day object before sending. Add request timeout (e.g. 90s) and log per-month duration for observability.
- **Python:** No change.
- **Client:** Same as Option A: one `fetch` to discover-range, replace current per-month loop.

### 6.5 Pros and cons

| Pros | Cons |
|------|------|
| No Python changes; faster to ship and easy to roll back | Client still waits for full range (no partial results unless we add streaming later) |
| One client round trip; server handles parallelism | Next.js holds one long-lived request; need timeout and monitoring |
| Can add summary-only by stripping `sessions` in Next.js | 12 internal HTTP calls from Next.js to Python; total LiveRC work unchanged |

### 6.6 Effort and risk

- **Effort:** Medium. Next.js route + client change only.
- **Risks:** Long-running Next.js request; ensure Vercel/server timeout allows it or run in self-hosted with higher limit. Many concurrent outbound fetches from Next.js to Python; ensure connection pool and limits are adequate.

---

## 7. Option C — Pure-Client Improvements (No New Endpoints)

### 7.1 Description

Keep the architecture unchanged (one `POST /api/v1/practice-days/discover` per month from the browser). Improve behaviour entirely on the client: (1) stream partial results as each month completes (concurrency-limited queue, update state per month); (2) abort in-flight requests when search or toggle changes; (3) skip discovery when DB already covers the range; (4) reduce default range to 180 days; (5) optionally persist range in localStorage for repeat searches.

### 7.2 Data flow

- Unchanged: event search returns; client computes range and months.
- **Change 1:** Instead of batching 6 → wait → next 6, use a concurrency limit (e.g. `p-limit(6)`) so that as soon as **any** month completes, its results are merged into state: `setDiscoveredPracticeDays(prev => mergeByDate(prev, newRows))`. User sees rows appear incrementally.
- **Change 2:** One `AbortController` for the current discover run; when starting a new discover, abort the previous controller and pass the new signal to all fetches.
- **Change 3:** Before dispatching any request, compute the set of ingested dates from `practiceDaysFromDb`. If the range is fully covered (e.g. every month in the range has at least one ingested date, or min(ingested) ≤ range_min and max(ingested) ≥ range_max), skip discovery and return [].
- **Change 4:** When `practiceRangeMin` and `practiceRangeMax` are both null, use “last 180 days” (or 6 months) instead of 12 months.
- **Change 5 (optional):** Store last `practiceRangeMin/Max` (or months) in localStorage keyed by track id; next time the same track is searched, reuse if still valid.

### 7.3 Implementation notes

- **Concurrency:** Replace the `for (let b = 0; b < months.length; b += 6)` loop with a queue that runs up to 6 fetches at a time and on each resolution: parse, filter by ingested dates, then `setDiscoveredPracticeDays(prev => dedupeAndMerge(prev, newRows))`. Use a ref or run id so stale completions do not overwrite newer state.
- **Abort:** Create `discoverAbortControllerRef.current` at start of discover; on new search or toggle off, call `abort()`. Pass `signal` to every `fetch`. On abort, clear discover state or leave last partial result; avoid showing stale “Checking LiveRC…”.
- **Skip logic:** `ingestedDates = new Set(practiceDaysFromDb.map(...).map(dateOnly))`. If range is [min, max], check if we have ingested data covering it (e.g. for each month in range, is there at least one ingested date in that month?). Simple heuristic: if `ingestedDates.size` is large and min(ingestedDates) ≤ practiceRangeMin and max(ingestedDates) ≥ practiceRangeMax, skip. Or: only request months that have no ingested date (gap-fill).
- **Default range:** In the branch where both `practiceRangeMin` and `practiceRangeMax` are null, set e.g. `practiceRangeMax = today`, `practiceRangeMin = today - 180 days` (or use date-fns `subDays`).

### 7.4 Pros and cons

| Pros | Cons |
|------|------|
| No server or API changes; quick to implement | Still 12 HTTP requests from browser when range is 12 months |
| Partial results improve perceived performance immediately | Redundant scrapes across users (no shared cache) |
| Skip and smaller default reduce work in common cases | Browser remains responsible for retries and timeouts |
| Abort and optimistic behaviour improve UX and reduce waste | Does not reduce load on LiveRC or ingestion service |

### 7.5 Effort and risk

- **Effort:** Low–medium. Client-only changes; some care needed for merge order and dedupe.
- **Risks:** Skip heuristic might be wrong (e.g. user added a filter and expects new discovery); keep heuristic conservative or make it “skip only when explicitly same range and all months have data.” Partial updates can cause brief UI churn (list re-sorting); use stable sort and merge by date.

---

## 8. Option D — Offline Pre-Fetch / Cache Table

### 8.1 Description

Move discovery **off the request/response path**. A scheduled job (cron or queue worker) periodically discovers practice days for a set of tracks (e.g. “active” or “followed”) and stores summary results in a **cache table**. Event Search, when “Include practice days” is on, reads from this cache only (Next.js/Prisma or Python/DB). No LiveRC calls while the user waits; discovery runs asynchronously and refreshes the cache.

### 8.2 Data flow

1. **Writer (async):** Cron or worker runs e.g. daily (or on a trigger). For each track in scope, compute a date range (e.g. last 90 days), call existing discovery (Python or internal) per month, and insert/upsert rows into `practice_day_discovery_cache` (e.g. `track_id`, `date`, `summary_json`, `refreshed_at`, optional `source_hash`).
2. **Reader (sync):** When the user runs event search with include practice days, the API (or a new read path) queries the cache table for the same track and date range, returns cache rows as “discovered” practice days. No LiveRC call.
3. **Staleness:** If cache is missing for a range or `refreshed_at` is older than TTL (e.g. 24h), either return what exists and optionally enqueue a refresh job, or return empty and enqueue; next run populates cache.

### 8.3 Schema (example)

```sql
-- Example; exact schema TBD
CREATE TABLE practice_day_discovery_cache (
  id UUID PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES track(id),
  practice_date DATE NOT NULL,
  summary_json JSONB NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL,
  UNIQUE(track_id, practice_date)
);
```

Index on `(track_id, practice_date)` for range reads.

### 8.4 Implementation notes

- **Ingestion / worker:** New job that iterates tracks (from config or DB), for each track calls existing discover logic (month by month), and writes to cache table. Handle failures per month; do not fail entire job.
- **API:** When include practice days is true, after reading ingested practice days from events table, also read from `practice_day_discovery_cache` for (track_id, date range). Merge with ingested; mark cache rows as “discovered” (not ingested). Optionally trigger async refresh if cache is stale.
- **Client:** Can stay as-is (single event search returns events + ingested + cache-backed “discovered”) or simplify to single request if “discovered” is now served from the same search response (no separate discover call).

### 8.5 Pros and cons

| Pros | Cons |
|------|------|
| Instant results for cached tracks/ranges; no user-facing LiveRC latency | Requires new table, job scheduler, and invalidation/refresh policy |
| Reduces LiveRC load (one scrape per track/range per period) | Long-tail tracks may never be in cache unless we add on-demand refresh |
| Fits well with “active tracks” or “followed” semantics | Stale data until next run; need clear TTL and optional “refresh” action |

### 8.6 Effort and risk

- **Effort:** High. Schema, migration, writer job, reader path, and ops (monitoring, backfill).
- **Risks:** Cache invalidation bugs; users may expect live data. Need to document that “discovered” is as of last refresh.

---

## 9. Option E — Progressive UI (Defer Discovery to User Action)

### 9.1 Description

Keep the checkbox but change when discovery runs. The main list shows **events + ingested practice days** only (from the single event search call). Discovered practice days are loaded only when the user explicitly opens a “Load practice days from LiveRC” panel or clicks “Check for more practice days.” That panel uses the current per-month discovery (or a future range API); the main table is never blocked by discovery.

### 9.2 Data flow

1. User runs search with “Include practice days” on. One `GET /api/v1/events/search?include_practice_days=true`; response includes events and ingested practice days. **No** automatic call to discover; combined list = events + ingested only.
2. User sees a CTA or section: “Check LiveRC for more practice days” / “Load discovered practice days.” On click, the client runs the current `discoverPracticeDaysInRange` (or a single discover-range call). Results appear in the same list or in a dedicated “Discovered” subsection.
3. Rest of flow unchanged: Import from discovered rows, etc.

### 9.3 Implementation notes

- **Client:** Do not call `discoverPracticeDaysInRange` automatically after search. Set `isCheckingPracticeDays = false` initially. Add a button or collapsible “Discover more practice days” that, when expanded or clicked, runs discovery and then merges into the list. Optionally show “X practice days from LiveRC available — Load” if we ever have a cheap way to know that (e.g. from cache).
- **Copy:** Make clear that “Include practice days” shows ingested + (after user action) discovered; discovery is on-demand to keep the first paint fast.

### 9.4 Pros and cons

| Pros | Cons |
|------|------|
| First paint matches event-only search (no discover latency) | Extra click; some users may not discover that “Load” exists |
| Minimal backend change; reuses current discover API | When user does trigger discovery, same slow behaviour unless combined with other options |
| Sets expectation that “discovered” is a separate step | |

### 9.5 Effort and risk

- **Effort:** Low. Client-only; one conditional to skip auto-discover and one CTA to run it.
- **Risks:** Discoverability and UX: users might expect “Include practice days” to show everything without an extra action. Good copy and placement are important.

---

## 10. Option F — Two-Phase Unified Search + Timeline (Background Job + SSE)

### 10.1 Description

Phase 1: Event search returns immediately with events and ingested practice days (as today), plus a **discovery job id**. Phase 2: A **background job** (queue worker) runs practice discovery for the same range; results are written to a cache or event store and pushed to the client via **Server-Sent Events** (or long polling). The client subscribes to the job’s event stream and appends discovered rows to the list as they arrive. No long-held HTTP request for discovery; cancellation is implicit (user navigates away and stops listening).

### 10.2 Data flow

1. **Phase 1:** `GET /api/v1/events/search?include_practice_days=true` (optional `mode=timeline`). Response: `track`, `events`, `practice_days`, `practice_range_min/max`, and `discovery_job_id` (enqueued job that will discover the same range).
2. Client: Renders events + ingested practice days. Opens SSE (or polling) to `GET /api/v1/search/timeline/:discovery_job_id/events` (or similar). Listens for new practice day records; on each event, appends to `discoveredPracticeDays` and re-renders.
3. **Worker:** Picks up job (track, range). For each month, calls existing discovery, writes normalized rows to a `timeline_discovery_cache` table (or append-only log). Each write triggers an SSE broadcast (or append to a list that the SSE endpoint reads). Worker marks job complete when done.
4. Client: On job-complete event, stops listening. Optionally show “Discovery complete” or “3 new practice days.”

### 10.3 Components

- **Queue:** BullMQ/Redis or Postgres-based job queue; job payload = `{ track_id, track_slug, start_date, end_date }`.
- **Worker:** Node or Python process that runs discovery (existing logic), writes to DB/cache, and notifies SSE channel.
- **SSE endpoint:** Next.js route that subscribes to job updates (Redis pub/sub or DB polling) and streams events to the client.
- **Cache/store:** Table or key-value store for “discovered practice days for job X” so the SSE endpoint can serve deltas and new clients can catch up.

### 10.4 Implementation notes

- **Scope:** Large. New queue, worker, SSE endpoint, and client subscription logic. Timeline UI (lanes) is optional and described in the original review; here we focus on “same list, streamed discovery.”
- **Reuse:** Discovery logic unchanged; worker calls same Python or Next.js discover path. Import flow unchanged.

### 10.5 Pros and cons

| Pros | Cons |
|------|------|
| No long-held request; first paint is instant; discovery is out-of-band | Highest implementation and ops cost |
| Partial results stream naturally; best perceived performance | Queue and worker infrastructure required |
| Shared cache possible (job keyed by track+range); multiple users can reuse | SSE scaling and reconnection need design |

### 10.6 Effort and risk

- **Effort:** High. Queue, worker, SSE, client subscription, and observability.
- **Risks:** Job lifecycle (cleanup, timeout), SSE reconnection and ordering, and cross-user caching semantics.

---

## 11. Option Comparison and Recommendation

### 11.1 Comparison matrix

| Criterion | A (Range API) | B (Server fan-out) | C (Client-only) | D (Cache table) | E (Progressive UI) | F (Job + SSE) |
|-----------|----------------|--------------------|-----------------|------------------|--------------------|----------------|
| Reduces client round trips | Yes (1) | Yes (1) | No (12) | Yes (0 discover) | No (0 until click) | Yes (0 for discover) |
| Partial results | If streamed | No | Yes | N/A | On demand | Yes |
| Server changes | Next + optional Python | Next only | None | DB + job + API | None | Queue + worker + SSE |
| Client changes | Replace loop with 1 call | Same as A | Queue + skip + abort + default | Optional | Skip auto-discover + CTA | Subscribe to SSE |
| LiveRC load | Unchanged | Unchanged | Reduced (skip + range) | Reduced (scheduled) | Same (on demand) | Unchanged per run; cacheable |
| Effort | Medium–high | Medium | Low–medium | High | Low | High |
| Rollback | New route only | New route only | Client only | Schema + job | Client only | Many components |

### 11.2 Recommended phasing

1. **Phase 1 (quick wins, no new APIs)**  
   - **Option C** tactics: incremental rendering (concurrency-limited queue, update state per month), abort on new search/toggle, skip discovery when DB covers range, default range 180 days.  
   - **Cross-cutting:** Pass `track_slug` when adding any discover-range API later; optionally add summary-only in Python for existing endpoint.  
   - **Post-import:** Optimistic update after import (4.6).

2. **Phase 2 (single round trip)**  
   - **Option B** (server-fanned fan-out, Next.js only): new `POST /api/v1/practice-days/discover-range`, client calls it once. Strip `sessions` in Next.js.  
   - Keeps Python unchanged; improves latency and simplifies client. Can later evolve to Option A if Python gains a range endpoint and/or streaming.

3. **Phase 3 (optional)**  
   - **Option A** with Python range endpoint + summary-only responses; optional streaming for partial results.  
   - Or **Option D** if the product prioritizes “instant” discovered list for active tracks and can accept cache freshness semantics.

Option **E** can be considered if the product prefers to keep “Include practice days” as “ingested only” by default and make LiveRC discovery explicitly on-demand. Option **F** is reserved for a later, larger investment in background jobs and real-time UX.

### 11.3 Success metrics

- **Time to first discovered row:** From search submit to first discovered practice day visible (with Phase 1 incremental render, target &lt; 5s for first batch).  
- **Time to full discovery:** From search submit to all months complete (target: align with current or better; Phase 2 should reduce total wall time by reducing RTT).  
- **Redundant discovery:** Fraction of discover runs that could have been skipped (DB already had full range); target reduction after skip logic.  
- **Post-import:** No full search refetch after import; optimistic update only (measure via network tab).

---

## 13. Performance test results (2026-02-15)

**Test:** Canberra track, range up to 180 days (capped at 12 months for discover).  
**Script:** `docker exec mre-app npx tsx scripts/speed-test-practice-day-search.ts`

### Before (no cache, no streaming)

| Step | Time |
|------|------|
| 1. Event search (include_practice_days) | ~67 ms |
| 2. Discover range (single request, all months) | **~40.4 s** |
| 3. Per-month (serial, cold) | 2025-11: 7 ms, 2025-12: 40.2 s, 2026-01: 40.2 s, 2026-02: 32.2 s |

**Time until practice days ready:** ~40.4 s (100% in discover-range).

### After (cache + timeouts + streaming)

**First run (cold cache):**  
- Step 2 discover range: ~43 s (unchanged; LiveRC scrape dominates).  
- Per-month timeouts (25 s/day, 15 s/month view) prevent runaway; semaphore 10.

**Second run (warm cache):**

| Step | Time |
|------|------|
| 1. Event search (include_practice_days) | ~100 ms |
| 2. Discover range (single request, all months) | **~54 ms** |
| 3. Per-month (serial, cache hit) | 2025-11: 5.6 ms, 2025-12: 1.8 ms, 2026-01: 1.8 ms, 2026-02: 2.9 ms |

**Time until practice days ready (cache warm):** **~153 ms** (event search + discover-range).  
**Discover-range share:** 35% (54 ms of 153 ms).

**Improvements implemented:**  
- **Cache:** In-memory (track_slug, year, month), TTL 10 min; API route returns cached result without calling service.  
- **Timeouts:** Month view 15 s, day overview 25 s; semaphore 10 for day fetches.  
- **Streaming:** Optional `stream: true` on discover-range returns NDJSON; client uses `onStreamMonth` to show partial results as each month completes.

---

## 12. References

- [Event Search: Include Practice Days — Design](event-search-include-practice-days-design.md)  
- [Practice Day Search Performance Review](../reviews/2026-02-14-practice-day-search-performance.md)  
- `src/core/events/search-events.ts`, `src/core/practice-days/discover-practice-days.ts`  
- `src/components/organisms/event-search/EventSearchContainer.tsx` (§ discover loop)  
- `ingestion/api/routes.py` (`discover_practice_days_endpoint`)  
- `src/components/organisms/practice-days/PracticeDayRow.tsx` (summary fields only)
