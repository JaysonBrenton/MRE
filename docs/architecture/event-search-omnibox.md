---
created: 2026-06-01
creator: Frontend Delivery Agent
lastModified: 2026-06-07
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
  - src/components/organisms/event-search/event-search-filter-draft.ts
  - src/components/organisms/event-search/event-search-status-filter.ts
  - src/components/organisms/event-search/event-search-filters-popover-layout.ts
relatedDocs:
  - docs/adr/ADR-20260601-event-search-omnibox-db-only.md
  - docs/architecture/search-feature.md
  - docs/architecture/event-search-include-practice-days-design.md
  - docs/frontend/liverc/user-workflow.md
  - docs/user-guides/event-search.md
  - docs/user-guides/global-search.md
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
3. **Full search is explicit.** Only the **Search** button runs a full search
   (including **LiveRC discovery when Search LiveRC is on**). Filter changes are
   staged in the Filters popover until **Apply**; neither Apply nor track
   selection triggers a search. LiveRC import still lives in **Actions → Find
   and Import Events**.
4. **Progressive disclosure.** Track Selection, Date Filter, Search LiveRC,
   Search Everlaps, Include practice days, and **Status** toggles (Include Ready
   / Include Scheduled) collapse into a **Filters** popover, surfaced as a small
   icon + "Filters" label with an active-filter badge.
5. **Reuse the pipeline.** The Search button runs the existing
   `GET /api/v1/events/search` track-scoped query (or browse when applicable).
   No parallel search engine is introduced for the results list.
6. **Browse with an empty omnibox (DB-only).** When the omnibox has fewer than 2
   characters and Search LiveRC / Include practice days are **off**, Search runs
   `GET /api/v1/events/browse` across **all tracks** (paginated, optional date
   range, **all catalogue rows** in the database — any `ingest_depth`). The
   track shown in Filters is **ignored** in this mode; pick a track suggestion
   or type 2+ characters to scope by track instead. **LiveRC discovery and
   practice discover never run without a track.** Search LiveRC / practice
   toggles are disabled until a track is selected. Track-scoped search with
   Search LiveRC off still surfaces only `laps_full` events in the results
   table.

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
- **`database_only`:** when `true`, only `laps_full` rows are returned (legacy).
  Empty-omnibox browse from the UI sends `database_only=false` so the paginated
  list includes the full catalogue (`ingest_depth` `none` and `laps_full`).
- **Response:** `{ events, total, page, page_size }` — each event includes
  `trackId` and `trackName`.
- **Never calls LiveRC.**

---

## 3. Components

| Component              | Responsibility                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventSearchOmnibox`   | Debounced (~250 ms) type-ahead input. Fetches `/suggest`, renders grouped `combobox`/`listbox` results, full keyboard support. Emits `onSelectTrack` / `onSelectEvent`. Owns no business state.                                                                                                                                                            |
| `EventSearchFilters`   | "Filters" button + portaled popover (`event-search-filters-popover-layout.ts`). Hosts Track Selection, Date Filter, **Search LiveRC**, **Search Everlaps**, Include practice days, and **Status** (Include Ready / Include Scheduled). Staged draft via `event-search-filter-draft.ts`; **Apply** commits without searching. Shows an active-filter badge. |
| `EventSearchForm`      | Lays out omnibox + Filters + Search/Stop. Wires omnibox selections to `onTrackSelect`/`onSearch` and `onSelectEvent`; forwards all filter/source/status toggles to `EventSearchFilters`.                                                                                                                                                                   |
| `EventSearchContainer` | Orchestration: DB + optional LiveRC discovery, practice discover, pagination, import polling, status filtering (`event-search-status-filter.ts`), localStorage. Retains `includeLiveRC`, `includeEverlaps`, `includePracticeDays`, `includeReady`, `includeScheduled`.                                                                                     |

### 3.1 Omnibox behaviour

- **Min query** 2 chars; below that the dropdown shows guidance, no fetch.
- **Debounce** ~250 ms; in-flight requests are aborted on new input.
- **Grouping:** Tracks first, then Events; each group labelled; keyboard arrow
  navigation crosses groups; `Enter` activates the highlighted item; `Escape`
  closes the dropdown.
- **Selecting a track** → `onSelectTrack(track)`: the form sets the committed
  selected track (summary updates). The user runs search with the **Search**
  button, honouring committed Filters (including LiveRC when Search LiveRC is
  on).
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
  on, Search Everlaps on, practice days on, Include Ready off, Include Scheduled
  off).
- **Portal:** popover renders via `createPortal` to `document.body` with fixed
  positioning from `computeEventSearchFiltersPopoverRect` so it is not clipped
  by the modal's `overflow-hidden` panels. Prefers opening below the trigger;
  flips above when viewport space is tight.
- Closes on outside click and `Escape` (suppressed while nested Track or Date
  modals are open).
- Contents (events mode): **Track Selection**, **Date Filter**, **Sources**
  (Search LiveRC, Search Everlaps), **Include practice days** (when feature flag
  on), and **Status** (Include Ready, Include Scheduled).
- **Clear filters** resets draft and committed state to
  `DEFAULT_EVENT_SEARCH_FILTER_DRAFT` and clears persisted track/date keys.

### 3.3 Status filters (client-side)

Implemented in `event-search-status-filter.ts`. Applied to the results list
after API merge (does not change backend queries).

| Toggle             | Default | Effect when off                                                            |
| ------------------ | ------- | -------------------------------------------------------------------------- |
| `includeReady`     | `true`  | Hide rows classified Ready (`ingest_depth = laps_full`, not future-dated). |
| `includeScheduled` | `true`  | Hide future-dated rows (Scheduled badge).                                  |

`eventMatchesStatusFilters`: Scheduled (future date) takes precedence over
Ready, matching `EventRow` badge logic. New, Importing, and Failed rows are
always shown. When both toggles are on, the filter is a no-op.

Draft fields live on `EventSearchFilterDraft` alongside track, date, and source
toggles; committed on Filters **Apply**.

### 3.4 Search / Stop

- **Search** runs the full pipeline (browse, track search, LiveRC discover,
  practice discover as applicable). Disabled when LiveRC or practice toggles
  require a track and none is selected, or while a search is in flight.
- **Stop** aborts in-flight fetches (`handleStopSearch` in container). Button
  enabled only while `isSearchingInFlight`.

### 3.5 Results (events mode)

- **EventRow** columns: name (optional LiveRC link), track (cross-track browse),
  status badge, date, actions (**Download**, **Retry import**, **Open**).
- **Include practice days:** combined list with `PracticeDayRow`; optional
  post-search chips filter All / Events / Practice days.
- **Pagination:** client-side for track-scoped lists; server-side for
  cross-track browse. Persisted under `mre_event_search_pagination`.

### 3.6 Persistence (`localStorage`)

| Key                           | Purpose                 |
| ----------------------------- | ----------------------- |
| `mre_favourite_tracks`        | Track picker favourites |
| `mre_last_track`              | Last committed track    |
| `mre_date_range_preset`       | Date preset enum        |
| `mre_last_date_range`         | Custom start/end        |
| `mre_use_date_filter`         | Legacy flag             |
| `mre_event_search_pagination` | Page + page size        |
| `mre_known_imported_events`   | Import UX hints         |

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
- **Status filters:** `eventMatchesStatusFilters` / `applyEventStatusFilters`
  unit tests; Ready/Scheduled precedence.
- **Filter draft:** `buildCommittedFilterDraft`, `isFilterDraftEqual`,
  `applyDatePresetToDraft`.
- **Popover layout:** `computeEventSearchFiltersPopoverRect` viewport
  flip/clamp.
- All runtime verification is **Docker-only**
  (`docker exec -it mre-app npm test`).
