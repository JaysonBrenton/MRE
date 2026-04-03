---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-03-22
description: Guide to unified search for events and sessions in My Race Engineer
purpose:
  Describes the current Global Search experience on /search. Older bookmarks to
  /event-search redirect here.
relatedFiles:
  - src/app/(authenticated)/search/page.tsx
  - src/components/organisms/search/SearchForm.tsx
  - src/components/organisms/search/SearchResultsTable.tsx
---

# Global Search (events and sessions)

## What shipped today

- **Route:** `/search` — **Global Search** in the left navigation rail (see
  `src/app/(authenticated)/search/page.tsx`).
- **Legacy URL:** `/event-search` redirects to `/search` for bookmarks (see
  `src/app/(authenticated)/event-search/page.tsx`).
- **Behaviour:** Text search across events and sessions, optional filters (e.g.
  driver name, session type, date range). Results link through to event analysis
  where data exists. This replaces the older dedicated “Event Search” page with
  a separate track modal and bulk LiveRC import from that screen.

## Prerequisites

- You must be logged into MRE.

## Using Global Search

1. Open **Global Search** from the navigation rail (or go to `/search`).
2. Enter a query and optional filters in the search form
   (`src/components/organisms/search/SearchForm.tsx`).
3. Review results in the results table
   (`src/components/organisms/search/SearchResultsTable.tsx`) and open an event
   to view analysis.

## Importing events from LiveRC

Bulk import from the search page is **not** the primary flow. Use **My Event
Analysis** on the dashboard: open the event search / discovery modal from the
dashboard shell to find tracks and import LiveRC events into MRE. See
[Getting Started](getting-started.md) and [Event Analysis](event-analysis.md)
for the current analysis workflow.

## Related documentation

- [Navigation](navigation.md) — rail layout and other routes
- [API reference](../api/api-reference.md) — `GET /api/v1/search`
