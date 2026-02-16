# Event Search: Include Practice Days — Design Document

**Status:** Implemented  
**Last updated:** 2026-02-15  
**Scope:** Event search with optional practice days in a single list; performance alignment with event-only search.

---

## 1. Overview

### 1.1 Purpose

This design describes the **Include practice days** behaviour on Event Search: when enabled, the same search returns **events** and **practice days** (ingested and discovered) in **one list**, ordered by date, with minimal context switching and with performance treated as critical.

### 1.2 Goals

- **Single list (Option B):** One combined, date-ordered list of events and practice days (no separate “Events” and “Practice days” sections).
- **Practice range = event min/max:** The date range used for practice days is derived from the **returned** event (and practice) data: from the oldest to the newest date in the result set.
- **Parity when no date filter:** When the user does **not** use “Filter by date range,” the system returns all events for the track (DB + LiveRC). With “Include practice days” on, it should return **all** ingested practice days from the DB and discover practice days over an appropriate range (event extent or a defined default when there is no data).
- **Performance:**  
  - Ingested practice days are read in the **Next.js app via Prisma** (no Python call for the list).  
  - Event and practice-day DB reads run **in parallel**.  
  - Event discover and practice discover run **in the background** after the DB result is shown. Practice discover uses a **single** `POST /api/v1/practice-days/discover-range` request (or streaming for partial results); default range when no data is **180 days**, capped at 12 months. **Cache** (per track/month, ~10 min TTL) makes repeat searches fast (tens to low hundreds of ms when warm).
- **Import from unified list:** Discovered practice days in the combined list show an **Import** button; the handler calls the existing practice ingest API (`POST /api/v1/practice-days/ingest`). After success, the row is treated as ingested (e.g. refresh ingested list or optimistically update state).
- **Python-side parallelism:** Practice discover **within each month** fetches day overviews **in parallel** (bounded concurrency), not sequentially, to reduce latency when many days exist in that month.
- **Caching:** Discovered practice days are cached **short-lived per (track, month)** so repeated requests for the same track and month within the TTL avoid re-scraping LiveRC.

### 1.3 Non-goals (out of scope for this design)

- Changing the standalone **Practice Days** search mode (track + month); it keeps its current flow and Python-based list.

### 1.4 Critical constraint: No changes to existing Event Search

**No changes will be made to existing Event Search features.** All work is additive and optional.

- When **Include practice days** is **off** (default), Event Search behaves exactly as before: same track selector, date range, Search action, event-only list, event discover from LiveRC, and all existing event row behaviour (status, import, view). No API, UI, or behavioural changes to the events-only path.
- When **Include practice days** is **on**, the only additions are: an optional query parameter, an optional response field, and a combined list that includes practice days. Existing event search behaviour (events, discover, import) is unchanged; practice days are merged into the same list and follow the same date/range rules.
- No removal or redesign of Event Search form, EventSearchContainer, EventSearchForm, EventTable, or event-only APIs. No regression to event-only search.
- **No further changes to the Event Search modal or anything inside it:** EventSearchModal, the "Event Search" header, search filters (Track, Select a Track, Date range, Include practice days, Execute Search), Current Track display, empty state copy, and all practice-day features and code that run within Event Search are implemented and must not be modified. Practice-day search performance improvements are also implemented; do not touch that code (discover-range, cache, client, Python) or the modal, form, or components.

### 1.5 Critical constraint: Event analysis dashboard must not be broken

**Nothing must be broken on the existing event analysis dashboard.** All event-related visualization features must remain working.

- When a user selects a **race event** (not a practice day), the event analysis dashboard must behave exactly as today: Event Overview, Event Sessions, My Events, Drivers tabs; all charts, tables, driver cards, heat progression, class filter; and any other event visualizations must not regress.
- Any work that touches the dashboard or event/practice data must be additive and conditional (e.g. gated by “is this a practice day?”). Existing event code paths and UI must not be broken. See also [Practice Day Dashboard Visualization Design](./practice-day-dashboard-visualization-design.md) for practice-day-specific dashboard behaviour and its explicit non-regression rules.

---

## 2. User Experience

### 2.1 When “Include practice days” is off (default)

- Unchanged Event Search: track (and optional date range) → one list of **events** (DB + LiveRC discover in background).
- No practice days in the list.

### 2.2 When “Include practice days” is on

- Same search trigger: user selects track, optionally “Filter by date range,” checks **Include practice days**, and clicks Search.
- **One list** is shown, ordered by date (newest first), containing:
  - **Events** (race events): from DB and from LiveRC discover, with existing status/import behaviour.
  - **Practice days (ingested):** from DB, same track (and same date semantics as events).
  - **Practice days (discovered):** from LiveRC, not yet ingested, in the same date range used for practice discover.
- Each row is either an event row (existing EventRow) or a practice-day row (PracticeDayRow). No separate sections; one scrollable, paginated list.
- **Discovered practice rows** show an **Import** button; on click, the app calls the existing practice ingest API. After success, that date is treated as ingested (see §5.6).
- **Loading:** DB result (events + ingested practice days) is shown as soon as the single search request returns. A short line can indicate that LiveRC is being checked for events and practice days; discovery does not block the initial render.

### 2.3 Controls and copy

- **Date range:** "When" presets (No filter, Last 3/6/12 months, This year, Custom); dates use the user's local timezone.
- **Checkbox:** “Include practice days” (Events mode only, when practice-days feature is enabled).
- **Description:** “Show practice days in the same list (range = oldest to newest event date).”
- **Results:** e.g. “N items found (events + practice days)” when the option is on; pagination label “items” instead of “events.”

### 2.4 Wireframes

The following wireframes illustrate the main screens and states. They are conceptual; exact layout and styling follow the app's design system.

**Event Search form (main view)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Event Search                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Track    [ Canberra Off Road Model Car Club    ▼ ]  [ Select a Track ] │
│                                                                          │
│  When     [ No filter                    ▼ ]  (or Last 3/6/12 months,   │
│           This year, Custom)                                             │
│                                                                          │
│  ☐ Include practice days                                                 │
│    Show practice days in the same list (range = oldest to newest …)     │
│                                                                          │
│  [ Search ]                                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Track selection modal (opened from "Select a Track")**

```
┌───────────────────────────────────────────────────┐
│  Track                                          ✕  │
├───────────────────────────────────────────────────┤
│  Current Track                                     │
│  ┌─────────────────────────────┐  ┌──────────────┐ │
│  │ Canberra Off Road Model …   │  │ Select a     │ │
│  └─────────────────────────────┘  │ Track       │ │
│                                    └──────────────┘ │
│  Favourite tracks                                   │
│  ┌───────────────────────────────────────────────┐ │
│  │ Silver State                    [View] [★]    │ │
│  │ Canberra Off Road Model Car Club [View] [★]   │ │
│  │ "The Dirt"                      [View] [★]   │ │
│  │ Nitro Challenge                 [View] [★]    │ │
│  │ +4 more                                       │ │
│  └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**Results — combined list (events + practice days)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  12 items found (events + practice days)                                 │
│  Checking LiveRC for events and practice days…                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Date        Name / Type              Status / Actions                    │
│  ─────────────────────────────────────────────────────────────────────  │
│  2025-10-25  Canberra Club Day        [Event]  Imported  [View]           │
│  2025-10-20  Practice – 20 Oct 2025   [Practice] Ingested  [View]       │
│  2025-10-18  Practice – 18 Oct 2025   [Practice] [ Import ]              │
│  2025-10-12  Nitro Challenge          [Event]  Discovered  [ Import ]    │
│  …                                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ← Previous   Page 1 of 2   Next →                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Empty state (before first search)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Ready to search                                                         │
│  Select a track and click Search to find events, or adjust the date      │
│  range and include practice days first.                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow and Practice Range

### 3.1 High-level flow

1. User runs search (track ± date range, include practice days on/off).
2. **Single API call** (when include practice days is on): `GET /api/v1/events/search?track_id=…&include_practice_days=true` (and optional `start_date` / `end_date`).
3. Backend runs **in parallel** (in-app only):
   - Event search (Prisma): events for track (± date filter), excluding practice-day events.
   - Practice-day search (Prisma): events for same track with `source_event_id` containing `-practice-` (± same date filter).
4. Response returns `track`, `events`, and (when requested) `practice_days`.
5. Frontend:
   - Computes **practice range** (see below).
   - Renders the combined list from `events` + `practice_days` immediately.
   - Starts **in background**, in parallel:
     - Event discover (existing): one LiveRC call for the track (± date range).
     - Practice discover: **one** call to `POST /api/v1/practice-days/discover-range` (or streaming) with the practice range; server fans out to Python per month; results merged and deduplicated against ingested practice days by date. Range is **capped to the most recent 12 months**; default when no data is **180 days**. Stale completions from a previous search are ignored via a discover-run id.
6. When discover responses arrive, the list is updated (new events and new practice days merged in, re-sorted by date).

### 3.2 Practice range semantics

The range used for **practice discover** (which months to request from LiveRC) is determined as follows.

| Condition | Practice range used |
|-----------|---------------------|
| At least one event or one ingested practice day in the response | **Min/max of returned dates:** `practiceRangeMin` = earliest `event_date` or practice `event_date`, `practiceRangeMax` = latest. Practice discover uses this range, **capped to the most recent 12 months**. Cache makes repeat searches fast. |
| No date filter, but user provided start/end (e.g. from a previous run) | Not used for practice range; we rely on returned data or default. |
| **No** events and **no** ingested practice days in the response, but user **has** “Filter by date range” enabled with start and end | **User’s date range:** `practiceRangeMin` = `start_date`, `practiceRangeMax` = `end_date`. |
| No events, no ingested practice days, and **no** date filter (or no dates) | **Default range:** last **180 days** from today (capped at 12 months for discover). This ensures we still discover practice days when the user expects “all” behaviour and the DB returns nothing. |

So:

- **With date filter:** Events and practice days (DB and discover) are scoped to the user’s range; practice discover uses either the returned data extent or the user range as above.
- **Without date filter:** Events and ingested practice days are “all” for the track; practice discover uses the extent of the returned data, or a default range when nothing is returned.

This aligns with the idea that “no date filter” means “all events / all practice days” where possible, and that practice days should behave like events for that case.

### 3.3 No date filter — DB and LiveRC

- **Events:** Request has no `start_date`/`end_date`. Backend returns all events for the track (subject to limit). Event discover is called without date range and returns all events for the track from LiveRC.
- **Ingested practice days:** Same request; when `include_practice_days=true`, backend calls `searchPracticeDayEvents` with no date filter, so **all** ingested practice days for the track are returned.
- **Practice discover:** Uses the practice range derived as in the table above (event min/max, or user range, or default when empty).

---

## 4. Backend Design

### 4.1 Event search API

- **Endpoint:** `GET /api/v1/events/search`
- **Existing query params:** `track_id` (required), `start_date`, `end_date` (optional).
- **New query param:** `include_practice_days` (optional). When `true` or `1`, the response includes ingested practice days for the same track (and same date filter, if any).

**Response (when `include_practice_days=true`):**

```json
{
  "success": true,
  "data": {
    "track": { "id", "source", "source_track_slug", "track_name" },
    "events": [ { "id", "eventName", "eventDate", "sourceEventId", "ingestDepth", … } ],
    "practice_days": [
      {
        "id": "uuid",
        "eventName": "string",
        "eventDate": "ISO date or null",
        "sourceEventId": "string",
        "trackId": "uuid",
        "ingestDepth": "string"
      }
    ]
  }
}
```

When `include_practice_days` is false or omitted, `practice_days` is not present (backward compatible).

### 4.2 Core logic (Next.js)

- **`src/core/events/repo.ts`**
  - **`searchEvents(params)`** — unchanged: returns events for track (± date), excluding rows with `source_event_id` containing `-practice-`.
  - **`searchPracticeDayEvents(params)`** — new: Prisma query for `Event` where `track_id` = param, `source_event_id` contains `-practice-`, and optional `event_date` between `startDate` and `endDate`. Returns a list of `{ id, eventName, eventDate, sourceEventId, trackId, ingestDepth }`. No Python; same process as event search.

- **`src/core/events/search-events.ts`**
  - **`searchEvents(input)`** — extended:
    - `SearchEventsInput` includes optional `includePracticeDays`.
    - When `includePracticeDays` is true: runs `searchEventsFromRepo` and `searchPracticeDayEventsFromRepo` **in parallel** (`Promise.all`), then returns `{ track, events, practiceDays }` (`SearchEventsWithPracticeDaysResult`).
    - When false: unchanged (returns `SearchEventsResult` only).

- **API route** (`src/app/api/v1/events/search/route.ts`): Reads `include_practice_days` from query; passes `includePracticeDays` into core; when true, responds with `practice_days` as above.

### 4.3 Why practice-day list is in Next.js (performance)

- Previously, the standalone Practice Days UI got its **list** of ingested practice days from the Python service (Next.js → HTTP → Python → DB), which added latency.
- For “Include practice days,” the list of ingested practice days is **only** read in the Next.js app via Prisma, so:
  - No extra network hop to Python for the list.
  - One HTTP request from the client returns both events and practice days.
  - Event and practice-day DB queries run in parallel in one process.

The Python service is still used for **practice discover** (LiveRC) and for **practice ingest**; it is no longer used to **list** ingested practice days when the user uses Event Search with “Include practice days.”

---

## 5. Frontend Design

### 5.1 State

- **`includePracticeDays`** (boolean): Whether the checkbox is on.
- **`practiceDaysFromDb`**: Ingested practice days from the last search (array).
- **`discoveredPracticeDays`**: Practice days returned by practice discover (LiveRC), not yet in DB (array).
- **`isCheckingPracticeDays`**: True while practice discover is in progress (for loading/status copy).

Existing event-search state (`events`, `hasSearched`, `isCheckingLiveRC`, etc.) is unchanged; when “Include practice days” is on, the **combined** list is derived from `events`, `practiceDaysFromDb`, and `discoveredPracticeDays`.

### 5.2 Combined list

- **Type:** Each item is either:
  - `{ kind: 'event', event: Event }`, or
  - `{ kind: 'practice', ingested: ApiIngestedPracticeDay }`, or
  - `{ kind: 'practice', discovered: DiscoveredPracticeDaySummary }`.
- **Computation:** `combinedListItems` = merge of:
  - All `events` (as event items),
  - All `practiceDaysFromDb` (as ingested practice items),
  - All `discoveredPracticeDays` (as discovered practice items),
  - Sorted by date (descending), with a stable sort key (e.g. event id, or date + slug).
- **Deduplication:** When merging discovered practice days, exclude any date that already appears in `practiceDaysFromDb` (by normalised date string, e.g. `YYYY-MM-DD`).
- **Pagination:** Applied to `combinedListItems` when `includePracticeDays` is true; otherwise pagination remains over `events` only. `totalItems` and `totalPages` are based on the active list (combined vs events).

### 5.3 Rendering

- When **not** include practice days: existing EventTable and event-only pagination.
- When **include practice days** and the combined list has items:
  - One list (e.g. a wrapper `div` with `role="list"`).
  - Optional status line: “Checking LiveRC for events and practice days…” (or similar) when `isCheckingLiveRC` or `isCheckingPracticeDays`.
  - For each item in the paginated slice of `combinedListItems`:
    - If `kind === 'event'`: render **EventRow** with existing props (status overrides, import progress, onSelectForDashboard, etc.).
    - If practice **ingested**: render **PracticeDayRow** with `date`, `trackName`, `isIngested=true`, `eventId`, `onView` → e.g. `onSelectForDashboard(eventId)`.
    - If practice **discovered**: render **PracticeDayRow** with `date`, `trackName`, session stats, `isIngested=false`, `onIngest` → calls practice ingest API (see §5.6).
- **Accessibility:** List and list items have appropriate roles; loading/status text is `aria-live="polite"` so the initial result is announced and updates don’t feel like the whole page is stuck.

### 5.4 Practice discover (frontend)

- **Inputs:** `trackId`, `practiceRangeMin`, `practiceRangeMax` (date strings), and the current `practiceDaysFromDb` (to exclude already-ingested dates).
- **Helper:** `getMonthsBetween(minDate, maxDate)` returns `[{ year, month }, …]` for every month in the range.
- **Helper:** `discoverPracticeDaysInRange(trackId, minDate, maxDate, ingestedPracticeDays)`:
  - Computes months = `getMonthsBetween(minDate, maxDate)`.
  - Builds set of ingested dates (e.g. `YYYY-MM-DD`) from `ingestedPracticeDays`.
  - Runs `Promise.all(months.map(({ year, month }) => fetch('/api/v1/practice-days/discover', { method: 'POST', body: JSON.stringify({ track_id: trackId, year, month }) })))`.
  - Parses each response; merges `practice_days` (or `practiceDays`) from all responses; filters out any date in the ingested set; returns the merged array.
- **When to run:** After the initial search response is received and the combined list is rendered. Started in the same “background” phase as event discover (`checkLiveRC`). Both can run in parallel: `checkLiveRC(...)` and `discoverPracticeDaysInRange(...)` are started together; when both complete, the UI updates (new events and new practice days merged in).

### 5.5 Default range when no data and no date filter

- If `practiceRangeMin` and `practiceRangeMax` are both null (no events, no ingested practice days, and no user date range), the frontend should set a **default range** before calling practice discover, e.g.:
  - Last **180 days** from today (capped at 12 months for discover), or
  - Current calendar year.
- This ensures “no date filter + include practice days” still shows discovered practice days when the DB returns nothing.

### 5.6 Import from unified list

- **Trigger:** User clicks **Import** on a discovered practice day row in the combined list.
- **API:** Call existing `POST /api/v1/practice-days/ingest` with body `{ track_id, date }` (same as standalone Practice Days import). Use `ingestPracticeDay()` from `src/core/practice-days/ingest-practice-day.ts` (Next.js proxies to Python).
- **Request:** Use the selected track id and the practice day’s date (e.g. from `discovered.date` or `discovered.event_date`).
- **Loading / error:** Show loading state on that row (e.g. disabled button or spinner) while the request is in flight; on error, show an error message (toast or inline) and leave the row as discovered.
- **Success:** Treat that date as ingested so the list reflects it without a full refetch if possible:
  - **Option A (recommended):** Refetch search with `include_practice_days=true` so the backend returns the new practice day in `practice_days`; replace `practiceDaysFromDb` (and optionally clear that date from `discoveredPracticeDays`) and re-derive `combinedListItems`.
  - **Option B:** Optimistic update: add a synthetic ingested practice day for that date to `practiceDaysFromDb` and remove that date from `discoveredPracticeDays`; re-sort/merge. Ensures instant feedback; refetch can still run in background to align with server.
- **PracticeDayRow:** Reuse existing `PracticeDayRow` behaviour: when `isIngested=false` and `onIngest` is provided, show the Import button; `onIngest(date)` is invoked on click. The container supplies `onIngest` that performs the API call and then refresh or optimistic update as above.

---

## 6. Python service: parallelism and caching

These behaviours apply to the **practice discover** path in the Python ingestion service (used when the frontend calls `POST /api/v1/practice-days/discover` per month).

### 6.1 Within-month parallelism

- **Current behaviour:** For each month, after determining which dates have practice (e.g. from a month calendar or list), the service fetches **day overviews** one by one in a loop (e.g. `for practice_date in dates_with_practice: fetch_practice_day_overview(...)`), which can be slow when many days exist in that month.
- **Target behaviour:** Within each month, fetch day overviews **in parallel** with **bounded concurrency** (e.g. semaphore or fixed-size pool) so that many days in the same month do not multiply latency linearly.
- **Implementation notes:**
  - After `dates_with_practice` is known for the month, schedule all `fetch_practice_day_overview(track_slug, practice_date)` (or equivalent) calls in parallel, e.g. `asyncio.gather` with a semaphore limiting concurrent requests (e.g. 5–10) to avoid overloading LiveRC.
  - Preserve per-date error handling: one failing date should not fail the whole month; return partial results and log failures.
- **Scope:** Only the “month view” path; the existing fallback path that already uses parallel probes can remain as is.

### 6.2 Caching of discovered practice days

- **Goal:** If practice discover is expensive (multiple LiveRC requests per month), avoid re-running it for the same (track, month) within a short window.
- **Cache key:** `(track_slug, year, month)` — one entry per track and calendar month.
- **TTL:** Short-lived, e.g. **5–15 minutes**. Configurable via env or constant is desirable.
- **Storage:** In-memory in the Python process (e.g. a dict or cache with TTL, or a small LRU cache with timestamp). Alternatively, HTTP cache headers on the discover response could be used if the client/Next.js proxy respects them; in-memory is simpler and keeps cache co-located with the code that does the work.
- **Invalidation:** No need to invalidate on ingest for this design; cache is “discovered (not yet ingested)” data. Optional: invalidate the (track, month) entry when a practice day for that month is ingested, so the next discover returns the updated picture; can be added later.
- **Bypass:** Optional query param or header (e.g. `?refresh=1`) to skip cache for testing or user-triggered refresh; not required for MVP.

---

## 7. Queueing, caching, parallelism, and multi-user behaviour

### 7.1 There is no queue for search or practice discover

- **Event search** and **practice discover** are **not** queued. Each request is handled immediately in the request context.
- **Queueing in this codebase** applies only to **ingestion** (event ingest, practice ingest when the user clicks Import). When `INGESTION_USE_QUEUE=true`, ingest requests return 202 with a `job_id` and a background worker processes jobs from an in-process queue. That queue does **not** affect search or discover: multiple users can search and trigger practice discover at the same time without being serialized by the ingestion queue.

### 7.2 Caching (practice discover only)

- **Where:** In the **Python** practice discover path (per §6.2). Not in Next.js for this feature.
- **Key:** `(track_slug, year, month)` — one cache entry per track and calendar month.
- **Storage:** In-memory in the Python process. TTL 5–15 minutes (short-lived).
- **Effect:** If User A and User B both search the same track with “Include practice days” and the same month is in range, the **first** request that month does the LiveRC work; the **second** can be served from cache (until TTL expires). So caching is **shared across users** for the same (track, month); it reduces load on LiveRC and speeds up repeated or overlapping searches.
- **Multi-user:** Cache is read-only on hit; concurrent requests for the same key may both miss and both run discover until the cache is implemented with a per-key lock or “single-flight” to avoid duplicate work — design leaves that as an optional refinement.

### 7.3 Parallelism (no cross-user serialization)

Parallelism is used **within** each user’s flow to reduce latency; it does **not** serialize or queue users.

| Layer | What runs in parallel | Scope |
|--------|------------------------|--------|
| **Next.js (search API)** | Event DB query and practice-day DB query | Single request: `Promise.all([searchEventsFromRepo, searchPracticeDayEventsFromRepo])`. |
| **Frontend (after search)** | Event discover and practice discover | Same user: `checkLiveRC(...)` and `discoverPracticeDaysInRange(...)` started together. |
| **Frontend (practice discover)** | **One** HTTP call to discover-range (or streaming); range capped to 12 months, default 180 days | Single request; optional streaming for partial results; discover run id ignores stale completions; abort on new search. |
| **Python (practice discover)** | Within each month: fetch day overviews | Single request: after `dates_with_practice` is known, day overviews fetched in parallel with a semaphore (e.g. 5–10 concurrent) so one month with many days doesn’t scale linearly in time. |

So: **User 1** and **User 2** each get their own request; each request can use internal parallelism. There is no global “one search at a time” or “one discover at a time” lock.

### 7.4 Multiple users searching at the same time

- **Yes, the solution is designed so multiple users can search at the same time.**
- **Search API:** Each `GET /api/v1/events/search` is independent. Next.js and the DB handle concurrent reads; Prisma/DB concurrency is the only shared resource (normal for web apps).
- **Practice discover:** Each user’s browser fires multiple `POST /api/v1/practice-days/discover` calls (one per month). Different users’ requests are independent; the Python service can handle many concurrent requests. When caching is added, cache key is `(track_slug, year, month)` — so same track+month from two users can share one cached result after the first completes.
- **Import (ingest):** If the ingestion queue is enabled, **ingest** requests (event or practice) are queued and processed by a limited number of workers. So “search” and “discover” remain concurrent across users; only “import” is serialized (or limited) by the queue.

---

## 8. Performance Summary

| Concern | Design decision |
|--------|------------------|
| List of ingested practice days | Served from Next.js (Prisma). No Python call for the list. |
| Event + practice DB reads | Run in parallel in one request (`Promise.all`). |
| When user sees results | As soon as the single search response returns (events + ingested practice days). |
| Event discover | Runs in background after results are shown; does not block initial paint. |
| Practice discover | Runs in background; **single** discover-range request (or streaming); default range 180 days, capped at 12 months; **cache** makes repeat searches fast (tens–hundreds of ms when warm). |
| Blocking on LiveRC | Neither event nor practice discover blocks the initial list; both are best-effort background updates. |

---

## 9. Edge Cases and Behaviour

| Scenario | Behaviour |
|----------|-----------|
| No date filter, include practice days on | Events and ingested practice days: all for track. Practice discover: range = min/max of returned data, or default range if none. |
| Date filter set, include practice days on | Events and ingested practice days: filtered by date. Practice discover: range = min/max of returned data, or user start/end if no data. |
| No events, no practice days returned, no date filter | Practice discover: use default range (last **180 days**, capped at 12 months) so some practice days still load. |
| Track with no events and no ingested practice days | Combined list may be empty initially; practice discover (with default range) populates discovered practice days. |
| User turns off “Include practice days” and searches again | Normal event-only search; practice state is cleared. |

---

## 10. Related Files and References

- **Core:** `src/core/events/repo.ts`, `src/core/events/search-events.ts`, `src/core/practice-days/ingest-practice-day.ts`
- **API:** `src/app/api/v1/events/search/route.ts`, `src/app/api/v1/practice-days/ingest/route.ts`
- **UI:** `src/components/organisms/event-search/EventSearchContainer.tsx`, `EventSearchForm.tsx`, `EventRow.tsx`; `src/components/organisms/practice-days/PracticeDayRow.tsx`
- **Python:** `ingestion/services/practice_day_discovery.py` (discover; add within-month parallelism and caching per §6), `ingestion/api/routes.py` (practice-days discover and ingest endpoints)
- **Docs:** `docs/architecture/liverc-ingestion/05-api-contracts.md`, `docs/development/speed-test-search.md`, `docs/architecture/search-feature.md`
- **Practice range and no-date-filter behaviour:** This document, Section 3.2 and 3.3. **Import, parallelism, caching:** Sections 5.6 and 6.

---

## 11. Future Considerations

- **Default range:** Make the default practice-discover range (when there is no data and no date filter) configurable (e.g. env or constant) and document in ops.
