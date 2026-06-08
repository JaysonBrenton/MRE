---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-06-07
description: Guide to unified Global Search (`/search`) in My Race Engineer
purpose:
  Describes the shipped search UX, Redux-backed pagination, and how results tie
  into My Event Analysis.
relatedFiles:
  - src/app/(authenticated)/search/page.tsx
  - src/store/slices/searchSlice.ts
  - docs/architecture/search-feature.md
relatedDocs:
  - docs/user-guides/event-search.md
  - docs/user-guides/dashboard.md
---

# Global Search (`/search`)

![Initial search page before submitting](./images/global-search-empty.png)

Global Search is a **standalone page** for cross-corpus keyword lookup across
**events and sessions**. It is distinct from the dashboard **Event Search**
modal (⌘E / **Find Events**), which focuses on track-scoped discovery and
import. See [Event Search](event-search.md).

The legacy `/event-search` route redirects here. The navigation rail label is
**Global Search** (`navigationRailConfig.tsx`).

Once you submit criteria, Redux calls `performSearch()`, filling **Events** and
**Sessions** tables plus pagination widgets.

![Results split into Events and Sessions sections](./images/global-search-results.png)

## Form layout

| Control               | Behaviour                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- |
| **Search**            | Free-text spanning event + session corpus (placeholders cue cross-surface lookups). |
| **Driver Name**       | Optional narrowing filter forwarded to `/api/v1/search`.                            |
| **Session Type**      | Select `race`, `heat`, `main`, `seeding`, `practice`, `qualifying`, or “All Types”. |
| **Start / End dates** | Optional inclusive window (HTML `<input type="date">`).                             |
| **Search** button     | Validates + executes query. Disabled while Redux `isLoading` true.                  |
| **Clear**             | Resets slices + wipes tables back to untouched instructions.                        |

## Results tables

Sections render independently:

- **Events** — Columns: Event name, Track, Date, Actions (**View Event** →
  `/eventAnalysis?eventId=…`).
- **Sessions** — Session label, normalized class column, inferred type, parent
  event metadata, Actions link (same routing pattern anchored on `eventId`).

Large result sets honour **pagination** identical to Analysis list components:

- Page controls + **Rows per page** (`10`, `25`, `50`, `100`).
- `First / Previous / Next / Last` respecting disabled states.

## Importing versus searching

Searching **does not** replace ingestion. Use the dashboard **Event Search**
modal (**Find Events** / ⌘E) or **Actions → Find and Import Events** on My Event
Analysis to discover and import LiveRC events. Global Search simply helps you
recall UUIDs / programme titles already resident in the warehouse.

## Breadcrumbs / navigation

`/search` shows `My Event Analysis › Search`; treat **My Event Analysis** crumb
as shortcut back home.

## Related guides

- [Event Search (dashboard modal)](event-search.md)
- [Getting started](getting-started.md)
- [My Event Analysis](dashboard.md)
- [Event Analysis visuals](event-analysis.md)
- [Navigation](navigation.md)
