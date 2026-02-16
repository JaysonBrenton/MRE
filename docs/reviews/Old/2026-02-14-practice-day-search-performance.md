# Practice Day Search Performance Review — 2026-02-14

## Executive Summary
- Users perceive the **Include Practice Days** toggle as extremely slow because every search launches up to 12 serial batches of per-month discovery requests that traverse Browser → Next.js → Python ingestion → LiveRC before any new rows render.
- Each payload currently contains full session detail, bloating bandwidth even though the UI only needs summary stats, and the client reruns discovery even when the database already covers the requested range.
- Recommended remediation is to collapse the multi-hop fan-out into a server-side range endpoint (streaming if possible), stream partial results or otherwise surface them incrementally, trim payloads to summaries, and gate discovery to the actual gaps so LiveRC is only queried when necessary.

## Reproduction Steps
1. Navigate to the Event Search page, select any active track (e.g., "Canberra Off Road"), leave **Include practice days** unchecked, and run a search: results appear almost immediately because only `/api/v1/events/search` executes (DB only).
2. Using the same track and filters, enable **Include practice days** and run the search again: observe the initial results load followed by a prolonged "Checking LiveRC for events and practice days…" state while multiple `/api/v1/practice-days/discover` calls fire; network tab shows 6 concurrent requests at a time until up to 12 total complete.
3. Repeat step 2 with no date filter and no existing events for the track: the client defaults to a 12-month sweep, so you'll see a full cascade of month requests and a noticeably longer wait before practice rows appear (if at all).

## Context
- Scope: Event Search page when **Include Practice Days** is enabled (combined events + practice list).
- Goal: explain why the toggle feels "very very slow" and enumerate remediation paths.
- Sources reviewed: `EventSearchContainer` (client), `/api/v1/events/search`, `/api/v1/practice-days/discover`, practice-day ingestion service, and supporting scripts.

## Current Data Flow (Include Practice Days = true)
1. The browser requests `/api/v1/events/search?include_practice_days=true`. The handler runs two Prisma queries in parallel and returns `events`, all ingested practice days, and `practice_range_min/max` (`src/core/events/search-events.ts:50-109`).
2. Once the first response arrives, the client always kicks off `discoverPracticeDaysInRange()` (`src/components/organisms/event-search/EventSearchContainer.tsx:1086-1334`). That helper:
   - Builds the list of months between `practice_range_min` and `practice_range_max` (defaulting to "last 12 months" when no range exists).
   - Issues one `fetch('/api/v1/practice-days/discover')` **per month** with concurrency limited to six (`EventSearchContainer.tsx:335-425`).
   - Each Next.js `/practice-days/discover` call re-fetches the track row just to obtain the slug, then makes another HTTP request to the Python ingestion service, which in turn scrapes LiveRC and returns a payload that includes the full session list for every day (`src/core/practice-days/discover-practice-days.ts:14-95`, `ingestion/api/routes.py:872-960`).
   - Only after **all** month calls settle does the client merge and display the practice days.
3. Importing a discovered practice day triggers yet another `/api/v1/events/search?include_practice_days=true` round-trip just to refresh the list (`EventSearchContainer.tsx:2707-2826`).

## Findings

### 1. Multi-hop per-month discovery dominates latency
- Every practice month requires: Browser → Next.js (auth + validation) → Prisma (to resolve track slug) → Python HTTP call → LiveRC scraping (`EventSearchContainer.tsx:358-425`, `src/app/api/v1/practice-days/discover/route.ts:18-74`, `src/core/practice-days/discover-practice-days.ts:14-95`). Even when all data is cached, the client still has to wait for six HTTP responses before it can start the next batch of six.
- Impact: A "default" search (no date filter, empty DB range) immediately fires **12** expensive requests; slowest batch gates the rest because batches run sequentially. When LiveRC is sluggish, users stare at "Checking LiveRC for events and practice days…" for tens of seconds.
- Recommendation:
  1. Push the multi-month loop to the server: expose a `POST /api/v1/practice-days/discover-range` that accepts start/end dates (chunked server-side into ≤3 month windows) so that one client request can fan out internally without RTT amplification.
  2. Pass `track_slug` from the client to skip the second Prisma lookup per month.
  3. If the above is too large, at least drive the existing per-month loop from the server (Next API → ingestion) so that the browser deals with a single response.

### 2. Sequential batching + end-of-run rendering hides partial results
- `discoverPracticeDaysInRange` waits for every month in the batch to finish before starting the next batch (`EventSearchContainer.tsx:409-425`), then parses and filters **after** all batches settle (`EventSearchContainer.tsx:442-481`). Only then does it call `setDiscoveredPracticeDays`. Users never see partial rows, so the UX feels blocked even if some months finished quickly.
- Recommendation: replace the "batch, wait, then parse" loop with a concurrency-limited queue (e.g. `p-limit`) that streams months as soon as they finish and updates `discoveredPracticeDays` incrementally. Even showing the first couple of months within 2–3 seconds drastically improves perceived performance.

### 3. Payload bloat — every response includes full session detail
- The ingestion route currently serializes every session (driver, laps, URLs) for each practice day (`ingestion/api/routes.py:924-952`). The UI only uses summary stats (`session_count`, `total_laps`, `unique_*`, `time_range_*`) in `PracticeDayRow` (`src/components/organisms/practice-days/PracticeDayRow.tsx:1-88`).
- Impact: each month response can easily be hundreds of kilobytes, multiplied by up to 12 concurrent requests and then duplicated (ingestion → Next → browser). This is pure data overhead that does not benefit the list view.
- Recommendation: add a summary-only mode to the ingestion endpoint (or strip `sessions` before returning from Next.js). Keep the detailed payload behind a separate "view details" call so that discovery responses stay lightweight.

### 4. Practice discover runs even when there is nothing new to discover
- On every search with the toggle on, the client sets `practiceDaysFromDb` but still fires LiveRC discovery for the computed range with no short-circuit (`EventSearchContainer.tsx:1056-1075`, `1300-1334`). When all practice days for that range are already ingested, we still make up to 12 LiveRC calls just to throw away duplicates client-side.
- Recommendation: compare the requested range to the ingested dates before dispatching LiveRC requests. If there are no gaps (e.g. the oldest ingested practice day is newer than the `practiceRangeMin` and the newest matches `practiceRangeMax`), skip discovery entirely. Alternatively, send the list of ingested dates to the server so it can skip months that are fully ingested.

### 5. Default range always sweeps the last 12 months
- When there are no DB events (or event dates are null), the client falls back to `now - 12 months` through `now` (`EventSearchContainer.tsx:1164-1183`). Even narrow user-entered date ranges get expanded to a 12‑month sweep whenever `practice_range_min/max` are missing, guaranteeing the worst-case request volume.
- Recommendation: bound the fallback to a much smaller window (e.g. 90 days) or tie it strictly to the explicit date filter values. Consider surfacing an opt-in "Search last year" control instead of making it the implicit default.

### 6. No cancellation of in-flight discovery requests
- `discoverRunIdRef` prevents stale responses from overwriting state, but the original `fetch` calls keep running until timeout because there is no AbortController per _search_ (only per individual request for timeout). Searching a different track or toggling the checkbox off still burns bandwidth and CPU on the ingestion side.
- Recommendation: plumb a top-level `AbortController` into `discoverPracticeDaysInRange` and abort any outstanding month requests when a new search starts or when the toggle flips off.

### 7. Extra `/api/v1/events/search` after every practice import
- Importing a discovered practice day re-queries the entire combined search purely to refresh `practiceDaysFromDb` (`EventSearchContainer.tsx:2707-2826`). This duplicates the slow path even though the ingest endpoint already returns the ingested event id.
- Recommendation: Optimistically append the new ingested practice day to `practiceDaysFromDb` (or expose a slim `GET /api/v1/practice-days/:date`), and defer the heavy requery until the user explicitly refreshes.

## Suggested Next Steps
1. Design and implement a server-side range discovery endpoint (or extend the existing one) that accepts multiple months and streams summary data only.
2. Update the client to consume the above API, add cancellation, and stream partial results as they arrive.
3. Revisit the default range/fallback logic so that we only sweep LiveRC for the window the user asked for, and skip discovery entirely when the DB already covers the range.
4. Measure improvements with `scripts/speed-test-search.ts` while toggling `includePracticeDays` to confirm performance deltas and catch regressions early.

## Potential Resolution Approaches

### A. Consolidated Range API (preferred)
- **Description:** Replace the current “N separate `/practice-days/discover` calls” with a single endpoint that accepts a normalized date range (or list of months). The backend still respects the existing ingestion limit of three months per scrape by chunking the requested range internally, executing the scraper once per chunk, and concatenating the results server-side.
- **Implementation Details:**
  - Add `/api/v1/practice-days/discover-range` in Next.js. The handler validates dates, forwards `track_slug` (already fetched via Prisma during Phase 1), and passes an array of `{ year, month }` to the ingestion service.
  - Extend the Python ingestion API with an endpoint that accepts the same payload, loops over months, and returns a single envelope `{ practice_days: [...] }`. To avoid huge payloads, strip session detail unless explicitly requested.
  - For perceived performance, have the Next.js route stream partial JSON via chunked encoding or SSE: as soon as a month finishes scraping, send its summary rows to the client.
  - Cache final responses (or per-month sub-results) in Redis keyed by `(track, month)` so repeated searches within the TTL never hit LiveRC.
  - Surface per-month progress in the response header (e.g., `X-Practice-Progress: 3/8`) so the client can show accurate status text even without SSE.
- **Pros / Cons:** One round trip, easier caching (responses keyed by `(track, start, end)`), client code simplifies. Requires ingestion updates and streaming infrastructure (if we want partial rendering). Still synchronous: the browser waits until the server completes the range.

### B. Server-Fanned Fan-Out Without Streaming
- **Description:** Treat the existing `/practice-days/discover` endpoint as an internal helper. The browser continues to make a single call, but the Next.js API route loops over the months, awaiting each ingestion response sequentially or in parallel and merging the lists.
- **Implementation Details:**
  - The new `/discover-range` route lives only in Next.js. It computes months (reuse `getMonthsBetween()` helper), issues the current per-month fetches server-side, and merges/filters duplicates before returning to the client.
  - Because this all happens in the server runtime, we can run months in parallel (bounded) without exposing multiple requests to the browser.
  - To reduce payload size, intercept each per-month response and `delete` the `sessions` array before forwarding.
  - Add server-side retries/backoff so transient LiveRC failures don’t bubble up as multiple toast errors; respond with partial data plus a warning payload.
  - Instrument the route with per-month timing metrics so we know which tracks/months dominate latency and can pre-cache accordingly.
- **Pros / Cons:** No ingestion changes, easier rollback, good stepping stone toward streaming. Still requires the server to wait for all months before responding, so the client gains no partial updates. CPU/network load shifts from browser -> server, but total LiveRC cost stays the same.

### C. Pure-Client Improvements
- **Description:** Keep the architecture identical but make the client smarter so that the user doesn’t have to wait for 12 sequential requests. `discoverPracticeDaysInRange` becomes a concurrency-limited queue that pushes partial results into state as soon as each fetch resolves.
- **Implementation Details:**
  - Swap the manual batching loop for `p-limit` or a homegrown semaphore that emits results to a callback; use `setDiscoveredPracticeDays((prev) => merge(prev, newRows))` so the list updates continuously.
  - Introduce a parent `AbortController` and pass `signal` to each fetch; when a new search starts, call `controller.abort()` so outstanding requests die immediately.
  - Analyze `practiceDaysFromDb` vs requested range: if every date in the range already exists in DB, skip discovery entirely; otherwise, only fetch the months that contain gaps. Fallback (no dates) defaults to 90 days instead of 12 months.
  - Persist the last `practiceRangeMin/Max` in `localStorage` so repeated searches for the same track reuse the computed window instead of recalculating from scratch.
  - Add telemetry (e.g., `clientLogger.info`) for each batch completion, including duration and items discovered, to pinpoint slow tracks without server logs.
- **Pros / Cons:** No server work, quick relief, preserves all current code paths. Still makes many requests and keeps the browser responsible for LiveRC retries/timeouts. Doesn’t solve redundant scrapes across users.

### D. Offline Pre-Fetch / Queueing
- **Description:** Move discovery out of the request/response path entirely. A cron job (or ingestion worker) periodically scrapes practice days for active tracks and stores them in a cache table. Event Search reads from the cache synchronously, avoiding LiveRC calls while the user waits.
- **Implementation Details:**
  - Add `practice_day_cache` table with `(track_id, date, summary_json, refreshed_at)` columns. Seed it nightly for active tracks.
  - When the user searches, the API first reads from this cache. If data is missing/stale, it triggers an async refresh but still responds with what it has.
  - Expiration policy ensures we don’t serve ancient data; ingestion job handles retries and metrics.
  - Store metadata such as `source_html_hash` so the cache can detect when LiveRC changes layout and flag entries for re-parsing.
  - Provide an operator dashboard (or CLI) to force-refresh specific tracks/months when users report stale data.
- **Pros / Cons:** Instant results for popular tracks, offline resilience. Requires ops investment (scheduler, monitoring) and cache invalidation logic. Doesn’t cover long-tail tracks unless jobs include them.

### E. Progressive UI Using Existing Components
- **Description:** Keep the checkbox but change its behavior: enabling it reveals an inline module that embeds `PracticeDaySearchContainer`. The main event table remains fast (events + ingested practice), while discovered practice days load only when the user clicks “Load more practice days.”
- **Implementation Details:**
  - Wrap the existing practice-days component in a collapsible panel under the event list. Pass the auto-selected `trackId`/date range so it can run its current month-based flow.
  - Deduplicate by date: ingested practice days remain in the combined list, while the embedded practice module shows only discovered rows with import buttons.
  - Provide progress text / manual refresh button to set expectations (“This may take ~30s; leave panel open”).
  - Allow the panel to remember the last viewed month/year so users can drill into specific windows without reselecting options.
  - Offer a “Queue imports” button within the panel that calls the existing bulk-ingest endpoint for all discovered rows currently visible.
- **Pros / Cons:** Minimal backend work, reuses UI. Shifts control back to the user so the page isn’t “stuck” automatically fetching months. Still inherits slow performance once users opt in.

### F. Two-Phase Unified Search + Timeline UI
- **Data Flow (Phase 1 = instantaneous response):** Keep the existing `GET /api/v1/events/search` handler but extend it to accept `mode=timeline`. The handler still calls `searchEventsFromRepo` and `searchPracticeDayEventsFromRepo` in parallel (`src/core/events/search-events.ts:80-109`), but the response groups rows into `timeline.lanes = { events: EventRow[], practice_ingested: PracticeDayRow[] }` and includes `next_discovery_job_id`. This matches today’s synchronous behavior, so users immediately see DB-backed events and practice days.
- **Data Flow (Phase 2 = streamed deltas):** Submitting a timeline search enqueues a `PracticeDiscoveryJob` (reusing `discoverPracticeDaysInRange` parameters) into a durable queue (BullMQ/Redis or Postgres advisory queue). Worker processes (Node or Python) call the existing ingestion discovery service once per `(track, month)` and persist normalized summaries into a `timeline_discovery_cache` table. Each insert also appends a record to `timeline_discovery_events` that the Next.js app exposes via `/api/v1/search/timeline/:jobId/events` (Server-Sent Events or long polling). The client listens and merges new rows into the “Discovered Practice” lane without reissuing LiveRC requests from the browser.
- **UI Composition:** The left-hand `EventSearchForm` remains unchanged (users still pick a track, date range, and toggles). The right-hand panel becomes a virtualized timeline with three labeled lanes stacked vertically:
  1. **Events (DB + LiveRC)** — uses the current `EventRow` component, including import buttons, dashboards, and participation badges.
  2. **Practice — Ingested** — renders `PracticeDayRow` with `isIngested=true`, showing the same stats and “View” action.
  3. **Practice — Discovered** — feeds the streamed deltas into `PracticeDayRow` with `onIngest` wired to the existing handler; rows show a pill (“LiveRC discovery incoming…”) until details arrive.
  Each lane has a compact filter pill (“Hide lane,” “Only show new”) and a mini-summary chip (e.g., “5 imported • 2 scheduled”). Pagination is replaced with virtualization (e.g., `react-virtualized`) so long histories stay responsive.
- **User Feedback Enhancements:** A status ribbon above the lanes displays `Phase 1 ready` immediately, then transitions to `Discovering practice days…` with per-month progress pulled from the job queue metadata. When the worker completes, the ribbon offers a CTA: “3 new practice days found — Import All.” Clicking it sequentially invokes the existing `/api/v1/practice-days/ingest` handler with throttling to avoid overwhelming ingestion.
- **Performance & Robustness:** Because phase-2 discovery runs out-of-band, repeated searches (or multiple users) reuse the cached summaries rather than triggering LiveRC repeatedly. Failures are logged once in the worker, surfaced as `discovery_status=degraded`, and the UI simply shows “LiveRC temporarily unavailable; showing cached data from <timestamp>.” The browser never waits on long-lived fetches, and cancellations are implicit: leaving the page just stops listening to SSE.
- **Implementation Reuse:**
  - Prisma models, API validators, and React row components remain untouched.
  - Existing helpers like `discoverPracticeDaysInRange` provide the parameters for the queue job; the worker just calls them server-side.
  - Import flows reuse `handleImportPracticeDay`; we simply supply the timeline context so state updates affect the right lane.
- **Scalability Hooks:** The cache table can track `(track_id, month)` freshness. When any user requests a stale month, the worker refreshes it once and subsequent listeners receive the update. We can also hydrate the cache via cron jobs so high-demand tracks always return instant practice data without new LiveRC work.
- **Operational Considerations:** expose Prometheus metrics for queue depth, job duration per (track, month), and SSE delivery lag; provide admin tools to replay specific jobs or inspect cached rows when debugging user reports.
- Pros: best UX (clear timeline, explicit deltas, virtualization), resilient background discovery, shared cache eliminates redundant scraping, and the worker architecture isolates LiveRC failures; Cons: largest lift (queue infrastructure, SSE/polling endpoint, timeline wrapper, virtualization) but future-proofs both the UI and ingestion.
