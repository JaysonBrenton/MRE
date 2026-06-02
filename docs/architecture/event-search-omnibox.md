---
created: 2026-06-01
creator: Frontend Delivery Agent
lastModified: 2026-06-01
description:
  Architecture and contracts for the database-only Event Search omnibox and the
  collapsed Filters control in the dashboard Event Search modal.
purpose:
  Define the type-ahead suggestion API, component responsibilities, and UX rules
  for the rebuilt dashboard Event Search experience.
relatedFiles:
  - src/app/api/v1/events/search/suggest/route.ts
  - src/core/events/suggest-event-search.ts
  - src/core/events/repo.ts
  - src/components/organisms/event-search/EventSearchOmnibox.tsx
  - src/components/organisms/event-search/EventSearchFilters.tsx
  - src/components/organisms/event-search/EventSearchForm.tsx
  - src/components/organisms/event-search/EventSearchContainer.tsx
relatedDocs:
  - docs/adr/ADR-20260601-event-search-omnibox-db-only.md
  - docs/architecture/search-feature.md
  - docs/frontend/liverc/user-workflow.md
  - docs/user-guides/event-search.md
---

# Event Search omnibox (database-only)

**Status:** Implemented (v0.1.x)

This document is the **normative** specification for the dashboard **Event
Search** modal after the June 2026 rebuild. It governs the omnibox, the
collapsed **Filters** control, and the suggestion API. The companion decision
record is [ADR-20260601](../adr/ADR-20260601-event-search-omnibox-db-only.md).

> **Scope.** This covers the **dashboard Event Search modal** opened with ⌘E /
> "Find Events" (`EventSearchModal`). It is distinct from the standalone
> **Global Search** page at `/search` (see
> [search-feature.md](./search-feature.md)).

---

## 1. Principles

1. **One obvious input.** A single omnibox is the primary control. It searches
   **track names** and **event names** simultaneously.
2. **DB-only type-ahead.** The omnibox **suggestions** read exclusively from the
   MRE database (no LiveRC), so the dropdown stays fast.
3. **Full search is unchanged.** Running a search (Search button, or selecting a
   track) keeps all prior behaviour — including **LiveRC discovery when Search
   LiveRC is on** (track + toggle on → DB **and** LiveRC events). LiveRC import
   still lives in **Actions → Find and Import Events**.
4. **Progressive disclosure.** Track Selection, Date Filter, Search LiveRC,
   Search Everlaps, and Include practice days collapse into a **Filters**
   popover, surfaced as a small icon + "Filters" label with an active-filter
   badge.
5. **Reuse the pipeline.** Selecting a track from the omnibox runs the existing
   `GET /api/v1/events/search` track-scoped query. No parallel search engine is
   introduced for the results list.
6. **Browse with an empty omnibox (DB-only).** When the omnibox has fewer than 2
   characters and Search LiveRC / Include practice days are **off**, Search runs
   `GET /api/v1/events/browse` across **all tracks** (paginated, optional date
   range, `laps_full` only). The track shown in Filters is **ignored** in this
   mode; pick a track suggestion or type 2+ characters to scope by track
   instead. **LiveRC discovery and practice discover never run without a
   track.** Search LiveRC / practice toggles are disabled until a track is
   selected.

---

## 2. Suggestion API

### 2.1 Endpoint

```
GET /api/v1/events/search/suggest?q={query}&limit={n}
```

- **Auth:** required (401 `UNAUTHORIZED` otherwise).
- **`q`:** trimmed query. Fewer than **2** characters returns empty groups.
- **`limit`:** max suggestions **per group** (default **8**, clamped 1–20).
- **Cache:** `no-store`.

### 2.2 Response

```jsonc
{
  "success": true,
  "data": {
    "query": "round 5",
    "tracks": [
      {
        "id": "trk_…",
        "trackName": "…",
        "sourceTrackSlug": "…",
        "city": "…",
        "state": "…",
        "country": "…",
      },
    ],
    "events": [
      {
        "id": "evt_…",
        "eventName": "…",
        "eventDate": "2026-05-30T00:00:00.000Z",
        "trackId": "trk_…",
        "trackName": "…",
        "ingestDepth": "laps_full",
      },
    ],
  },
}
```

### 2.3 Matching rules (DB-only)

**Tracks** (`prisma.track`):

- `isActive = true` **and** (`trackName` **or** `city` **or** `sourceTrackSlug`
  contains `q`, case-insensitive).
- Ranked by relevance (exact name → prefix name → name substring → city → slug
  substring), then `trackName` A–Z, capped at `limit`. This keeps exact matches
  such as **RCRA** visible when `q` also appears inside many slugs (`*rcra*`).

**Events** (`prisma.event`):

- `eventName` contains `q` (case-insensitive).
- **Exclude** synthetic practice-day rows (`sourceEventId` containing
  `-practice-`).
- **Exclude** non-ingested placeholders (`ingestDepth = none`) so every event
  suggestion is actionable.
- Ordered by `eventDate desc`, capped at `limit`. Each row includes its parent
  `trackName` for display.

The endpoint **must not** call LiveRC or any network connector.

---

## 2.4 Browse API (cross-track, DB-only)

```
GET /api/v1/events/browse?start_date=&end_date=&page=&page_size=&database_only=true
```

- **Auth:** required.
- **Pagination:** `page` (default 1), `page_size` (default 50, max 100).
- **Dates:** optional; same validation rules as track search when provided.
- **Response:** `{ events, total, page, page_size }` — each event includes
  `trackId` and `trackName`.
- **Never calls LiveRC.**

---

## 3. Components

| Component              | Responsibility                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EventSearchOmnibox`   | Debounced (~250 ms) type-ahead input. Fetches `/suggest`, renders grouped `combobox`/`listbox` results, full keyboard support. Emits `onSelectTrack` / `onSelectEvent`. Owns no business state.              |
| `EventSearchFilters`   | "Filters" button + popover. Hosts Track Selection, Date Filter, **Search LiveRC**, **Search Everlaps**, and Include practice days. Shows an active-filter badge.                                             |
| `EventSearchForm`      | Lays out omnibox + Filters + Search/Stop. Wires omnibox selections to `onTrackSelect`/`onSearch` and `onSelectEvent`; forwards all filter/source toggles to `EventSearchFilters`.                            |
| `EventSearchContainer` | Unchanged orchestration brain (DB + optional LiveRC discovery, pagination, import status, localStorage). All source/filter toggles (`includeLiveRC`, `includeEverlaps`, `includePracticeDays`) are retained. |

### 3.1 Omnibox behaviour

- **Min query** 2 chars; below that the dropdown shows guidance, no fetch.
- **Debounce** ~250 ms; in-flight requests are aborted on new input.
- **Grouping:** Tracks first, then Events; each group labelled; keyboard arrow
  navigation crosses groups; `Enter` activates the highlighted item; `Escape`
  closes the dropdown.
- **Selecting a track** → `onSelectTrack(track)`: the form sets the selected
  track and immediately runs the search, honouring the current Filters toggles
  (including LiveRC discovery when Search LiveRC is on).
- **Selecting an event** → `onSelectEvent(eventId)`: the container selects the
  event for the dashboard (same as the results-list "view" action) and the modal
  closes.
- **Accessibility:** `role="combobox"` input with `aria-expanded`,
  `aria-controls`, `aria-activedescendant`; `role="listbox"`/`option` results
  (mirrors `DriverNameFilter` and `PracticeDriverSelector`).

### 3.2 Filters popover

- Trigger: icon (e.g. `SlidersHorizontal`) + **"Filters"** label,
  `aria-haspopup="dialog"`, `aria-expanded`.
- **Badge** counts non-default filters (non-default date range, Search LiveRC
  on, Search Everlaps on, practice days on).
- Closes on outside click and `Escape`.
- Contents (events mode): **Track Selection**, **Date Filter**, **Search
  LiveRC**, **Search Everlaps**, and **Include practice days** (the last only
  when the practice-days feature flag is on).

---

## 4. Out of scope / non-goals

- **Type-ahead suggestions** never call LiveRC (full search still can, via the
  Search LiveRC toggle).
- No session-level (race) search — that remains on Global Search `/search`.
- No new persistence model; existing localStorage keys for track/date/preset are
  retained.

---

## 5. Testing

- **Core/repo:** `suggestEventSearch` returns capped, correctly-filtered tracks
  and events; `< 2` char queries short-circuit; practice/`none` rows excluded.
- **API route:** auth required; param parsing/clamping; standardized response.
- **Omnibox component:** debounce, min-length gating, grouped rendering,
  keyboard selection, callback emission.
- All runtime verification is **Docker-only**
  (`docker exec -it mre-app npm test`).
