---
title: "Performance Opportunities – MRE v0.1"
date: 2025-12-27
author: Codex (LLM performance agent)
purpose: Capture the most impactful performance improvement opportunities discovered during a repo-wide review so implementation agents can prioritize fixes without code changes yet.
---

## Context
- Reviewed `src/app`, `src/core`, and ingestion service modules to spot avoidable CPU, memory, and I/O overhead while staying inside the v0.1 scope defined in `README.md` and `docs/specs/mre-v0.1-feature-scope.md`.
- Guardrails from `docs/architecture/mobile-safe-architecture-guidelines.md` and the LiveRC ingestion specs remain the source of truth; the findings below quote those docs wherever they justify a change.
- No code was modified; this document records the current state so domain owners can size and schedule work.

## Findings & Opportunities

### 1. Dashboard analysis calls materialize every race + lap even though the endpoint only returns a summary
- `getEventAnalysisData` eagerly loads the full event graph (races → results → laps) and aggregates every driver metric in Node memory (`src/core/events/get-event-analysis-data.ts:83-195`).
- The `/api/v1/events/[eventId]/analysis` handler only serializes the `event` metadata and overall `summary`, discarding the expensive `races` and `drivers` payloads (`src/app/api/v1/events/[eventId]/analysis/route.ts:45-80`).
- DashboardClient immediately calls that endpoint on page load to fill the hero card, so every dashboard visit does the same heavy query/aggregation work that the Event Analysis page already performs later.
- **Opportunities**:
  1. Split the core logic into `getEventSummary(eventId)` (only metadata + counts) and `getEventAnalysisData(eventId)`; have the dashboard hit the lightweight version while the analysis page keeps the full object. This keeps the contract aligned with "UI components that call server actions which call core functions" (`docs/architecture/mobile-safe-architecture-guidelines.md:188-191`).
  2. Cache or precompute event-level aggregates (total laps, driver counts, date range) inside the ingestion pipeline so the dashboard can serve them from a narrow Prisma `select` instead of rehydrating LAP JSON for hundreds of drivers.
  3. If the full object must stay, return the already-computed `races`/`drivers` arrays to the client so we avoid doing the same Prisma traversal twice (dashboard, then `/events/analyse/[id]`).

### 2. Race detail API does ~5 Prisma round-trips per driver for transponder numbers
- `getRaceWithResults` loops every race result and calls `getTransponderForRace` sequentially to decorate transponder info (`src/core/races/repo.ts:46-123`).
- `getTransponderForRace` issues up to four separate Prisma queries (race order, event entry, overrides, driver fallback) per driver (`src/core/drivers/repo.ts:181-292`), so a 60-driver main triggers ~240 database hits for a single API request.
- The ingestion spec emphasizes that the entry list is the definitive source of transponders and must be fetched before race pages (`docs/architecture/liverc-ingestion/03-ingestion-pipeline.md:150-165`). We already have all EventEntry rows and overrides available by the time races are persisted.
- **Opportunities**:
  1. When fetching race results, issue one Prisma query that preloads `eventEntries` + `transponderOverrides` for the event and emit a map keyed by `(driverId, className)`; enrich results from that map rather than per-driver lookups.
  2. If overrides must be filtered by race order, fetch them once (`prisma.transponderOverride.findMany`) and cache the normalized ranges in memory before iterating results.
  3. Add regression tests under `src/__tests__` to confirm no extra Prisma calls are made per driver; this guards against future N+1 regressions.

### 3. Ingestion pipeline re-fetches EventEntry lists inside the innermost race loop
- `_process_races_parallel` executes `repo.get_event_entries_by_class` **for every race result** even though that list is static for the `(event, class)` pair (`ingestion/ingestion/pipeline.py:249-260`). A 12-race, 3-class event with 50 results per race results in 600 identical SQL queries during ingestion.
- The repository already returns EventEntry objects with drivers attached (`ingestion/db/repository.py:541-567`), so the data can be cached in memory with trivial structure like `{class_name: List[EventEntry]}`.
- This directly contradicts the "Entry list is fetched and parsed BEFORE race results" requirement in the ingestion spec (`docs/architecture/liverc-ingestion/03-ingestion-pipeline.md:150-165`). Once the entry list is parsed and persisted, ingestion should reuse it, not keep round-tripping to Postgres.
- **Opportunities**:
  1. Preload all event entries once per event (possibly grouped by class) and pass them into the race-processing loop so `DriverMatcher.match_race_result_to_event_entry` runs in memory only.
  2. When multiple races share the same class, cache the driver-matching results (driver ID ↔ EventEntry) per class to cut down RapidFuzz invocations.
  3. Instrument Prometheus metrics (e.g., `event_entry_cache_hits`) so we can confirm the cache eliminates redundant DB reads in staging before rolling to prod.

### 4. Imported-events API ignores query parameters, forcing the client to over-fetch and slice in memory
- DashboardClient requests `/api/v1/events?limit=5&cache=no-store`, but the route never reads `request.nextUrl.searchParams` and always returns the full list (`src/app/api/v1/events/route.ts:21-47`). The client then filters in JS (`src/components/dashboard/DashboardClient.tsx:115-133`).
- `getAllImportedEvents` has no pagination or selective `select` clause, so Prisma loads and serializes every fully ingested event, even though the dashboard only needs five names (`src/core/events/repo.ts:174-205`).
- Serving unnecessary payload violates the "mobile-safe" goal because mobile clients will pay for the extra JSON even if they only need a handful of rows.
- **Opportunities**:
  1. Add `limit`/`offset` parsing in the route and pass them to `getAllImportedEvents` via Prisma `take`/`skip`. Default to `limit=20` to stay safe for existing callers.
  2. Select only the columns used by the UI (id, eventName, eventDate, trackName) to shrink the serialized JSON.
  3. Promote this route to a server component fetch from the dashboard (per `docs/architecture/mobile-safe-architecture-guidelines.md:188-191`) so we avoid an extra client-side fetch and leverage Next.js caching instead of `{ cache: "no-store" }`.

### 5. Driver lists render the entire dataset twice without virtualization
- `DriverList` maps over the full driver array once for the mobile card layout and again for the desktop table, even though only one layout is visible at a time (`src/components/event-analysis/DriverList.tsx:117-199`). Large LiveRC events routinely exceed 150 drivers, which leads to >300 DOM nodes plus React reconciliation on every filter change.
- The repo already depends on `react-window` in `package.json:22-43` but no component uses it, so we are paying the bundle cost without the virtualization benefits.
- The Event Analysis user stories explicitly require "Drivers tab displays list of all drivers" (`docs/frontend/liverc/event-search-and-analysis-user-stories.md:232-242`); to hit that requirement on mid-range devices we need windowing.
- **Opportunities**:
  1. Use `react-window` (already installed) or the Next.js `Virtualizer` to render only visible rows. Since the data is static per load, virtualization will drastically cut main-thread time.
  2. Render either the card list or the table, not both. CSS `display: none` does not prevent React from constructing the hidden tree, so wrap layouts in responsive `useMemo` + `matchMedia` or split into separate components loaded via `next/dynamic`.
  3. Memoize sorting input by deriving `sortedDrivers` once per change; right now the `useMemo` reruns for every keystroke because `drivers` is a new array after each `selectedDriverIds` change. Passing the list through `useMemo(() => drivers, [])` or lifting the data to a server component will stabilize the reference.

## Suggested Next Steps
- Prioritize items 1–3 for backend teams: they remove thousands of redundant Prisma/SQL calls per request or ingest run and align with the ingestion design contract. Prototype with query logging enabled to capture the before/after delta.
- Frontend team can tackle item 4–5 together: implementing API-level paging naturally enables the dashboard to fetch via server components, and virtualization can be added while touching Event Analysis layouts.
- Once fixes land, add regression tests (Vitest + pytest) that assert: (a) event summary endpoint does not load lap rows, (b) race detail API emits at most O(1) DB queries per driver class, and (c) ingestion metrics show cache hit rates for entry lists.
