---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-06-07
description:
  Guide to the dashboard Event Search modal (Find Events) in My Race Engineer
purpose:
  Documents omnibox type-ahead, Filters popover, search modes, results table
  actions, import flow, and persistence for the track-scoped Event Search modal.
relatedFiles:
  - src/components/organisms/dashboard/shell/EventSearchModal.tsx
  - src/components/organisms/event-search/EventSearchContainer.tsx
  - src/components/organisms/event-search/EventSearchForm.tsx
  - src/components/organisms/event-search/EventSearchOmnibox.tsx
  - src/components/organisms/event-search/EventSearchFilters.tsx
relatedDocs:
  - docs/architecture/event-search-omnibox.md
  - docs/architecture/event-search-include-practice-days-design.md
  - docs/user-guides/global-search.md
  - docs/user-guides/dashboard.md
---

# Event Search (dashboard modal)

The **Event Search** modal is the primary way to find race events by track,
discover new events on LiveRC, import them, and pick an event for My Event
Analysis. It opens from **Actions → Find Events** or **⌘E** (Ctrl+E on
Windows/Linux).

> **Not Global Search.** Keyword search across events **and** sessions lives on
> the separate **Global Search** page at `/search`. See
> [Global Search](global-search.md).

Architecture and API contracts:
[event-search-omnibox.md](../architecture/event-search-omnibox.md).

---

## Opening the modal

| Entry point               | Behaviour                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Actions → Find Events** | Opens the resizable Event Search modal on `/eventAnalysis`.                  |
| **⌘E** (Ctrl+E)           | Same shortcut from the Event Analysis sidebar.                               |
| Omnibox event pick        | Selecting an event suggestion closes the modal and sets the dashboard event. |

The modal is resizable and draggable. Press **Escape** or click outside to close
without changing the active event (unless you picked a row or omnibox event).

---

## Search surface layout

The form has three primary areas:

1. **Omnibox** — type-ahead by track or event name (database only).
2. **Filters** — secondary controls in a popover (track, dates, sources,
   status).
3. **Search / Stop** — run or cancel the current search.

A one-line summary under the controls shows the committed track and date filter
(for example `Track: RCRA · Last 12 months` or
`Track: all tracks (database) · No filter`).

---

## Omnibox (type-ahead)

| Behaviour     | Detail                                                  |
| ------------- | ------------------------------------------------------- |
| Placeholder   | “Search by track or event name…”                        |
| Minimum query | 2 characters before suggestions load                    |
| Debounce      | ~250 ms; in-flight requests abort on new input          |
| Data source   | MRE database only (no LiveRC in the dropdown)           |
| Groups        | **Tracks** first, then **Events**                       |
| Keyboard      | Arrow keys move highlight; Enter selects; Escape closes |

**Selecting a track** sets the committed track in Filters (does not search until
you click **Search**).

**Selecting an event** opens that event for analysis immediately and closes the
modal (same as **Open** on an imported row).

Suggestions exclude synthetic practice-day rows and events with no ingested
content (`ingest_depth = none`), so every event suggestion is actionable.

---

## Filters popover

Click **Filters** (sliders icon). Changes are **staged** until you click
**Apply**; closing the popover without Apply discards unstaged edits. **Apply**
does not run a search.

A numeric **badge** counts non-default committed filters (date preset other than
No filter, Search LiveRC on, Search Everlaps on, Include practice days on,
Include Ready off, Include Scheduled off).

### Track

Opens the **Track Selection** modal (~1,100 active tracks):

- Search box filters by track name.
- **Star** a track to add it to **Favourites** (stored in browser
  `localStorage`, key `mre_favourite_tracks`). Favourites appear at the top of
  the modal list.
- Picking a track in the modal updates the Filters draft only until Apply.

Some modes require a track before Search is enabled (see
[Search modes](#search-modes)).

### Date filter

Opens the **Date Filter** modal with presets:

| Preset         | Range                                  |
| -------------- | -------------------------------------- |
| No filter      | No date constraint                     |
| Last 3 months  | Rolling 3 calendar months              |
| Last 6 months  | Rolling 6 calendar months              |
| Last 12 months | Rolling 365 days                       |
| This year      | 1 Jan through today                    |
| Custom         | User-chosen start/end (local timezone) |

Custom dates must fall within the **last 7 years through today**; future dates
are not allowed. Start must be on or before end.

Default committed preset after **Clear filters** is **No filter**.

### Sources

| Toggle              | When on                                                                             | Requires track |
| ------------------- | ----------------------------------------------------------------------------------- | -------------- |
| **Search LiveRC**   | Full search merges database results with LiveRC discovery for the selected track.   | Yes            |
| **Search Everlaps** | Reserved for a future data source; toggle persists but does not change results yet. | No             |

### Include practice days

When the practice-days feature flag is on, this toggle merges **practice days**
(ingested + discovered) into the same date-ordered list as events. Requires a
track. See
[event-search-include-practice-days-design.md](../architecture/event-search-include-practice-days-design.md).

After search, optional filter chips appear: **All**, **Events**, **Practice
days**.

### Status

Client-side filters on the results list (after the API returns):

| Toggle                | Default | When off                                                            |
| --------------------- | ------- | ------------------------------------------------------------------- |
| **Include Ready**     | On      | Hides events with full lap data in MRE (`laps_full` / Ready badge). |
| **Include Scheduled** | On      | Hides future-dated events (Scheduled badge).                        |

Other statuses (New, Importing, Failed) are always shown when present. Scheduled
status takes precedence over Ready when classifying a row.

**Clear filters** in the popover footer resets track, date preset, and all
toggles to defaults and clears related `localStorage` keys.

---

## Search modes

Only the **Search** button (or form submit) runs a full search. Filter Apply and
track picks do not.

| Mode                             | How to enter                                                                                         | API / behaviour                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Cross-track browse**           | Leave omnibox empty; Search LiveRC and Include practice days **off**; click Search (track optional). | `GET /api/v1/events/browse` across all tracks. Filters track is **ignored**. Paginated catalogue includes all `ingest_depth` values. |
| **Track-scoped DB search**       | Pick a track (omnibox, Filters, or prior session) with Search LiveRC **off**.                        | `GET /api/v1/events/search`. Results table shows **`laps_full` events only** (Ready).                                                |
| **Track-scoped + LiveRC**        | Select track; Filters → Search LiveRC **on** → Apply → Search.                                       | DB query plus background LiveRC discovery. New LiveRC rows appear with **New** status.                                               |
| **Track-scoped + practice days** | Select track; Include practice days **on** → Apply → Search.                                         | Combined events + practice list; practice discover runs in background.                                                               |

LiveRC discovery and practice discover **never run without a track**. Search
LiveRC and Include practice days toggles are disabled until a track is selected.

While a search runs, the primary button shows **Running…** and **Stop** cancels
in-flight requests.

---

## Results table

Columns: **Event name**, **Track** (shown in cross-track browse), **Status**,
**Date**, **Actions**.

### Status badges

| Status               | Meaning                                             | Typical action                            |
| -------------------- | --------------------------------------------------- | ----------------------------------------- |
| **Ready** (Imported) | Full lap data in MRE                                | **Open**                                  |
| **New**              | LiveRC-only row, not yet imported                   | **Download**                              |
| **Importing**        | Ingestion in progress (progress bar when available) | Wait                                      |
| **Failed**           | Last import failed                                  | **Retry import**; click badge for details |
| **Scheduled**        | Future event date                                   | No import until after the event           |

LiveRC event names may link to the source page (opens in a new tab).

If your driver name matches the entry list, a **You participated** chip appears
on the row.

### Row actions

| Button           | Shown when                    |
| ---------------- | ----------------------------- |
| **Download**     | New (importable) LiveRC event |
| **Retry import** | Failed import                 |
| **Open**         | Imported event with lap data  |

**Open** selects the event for My Event Analysis and closes the modal. Only one
import runs at a time; other Download/Retry buttons disable while an import is
active.

---

## Pagination

- **Rows per page:** 10, 25, 50, or 100 (persisted in `localStorage`,
  `mre_event_search_pagination`).
- Cross-track browse paginates server-side.
- Track-scoped lists paginate client-side (including combined event + practice
  rows when Include practice days is on).

---

## Persisted preferences

Browser `localStorage` (per device, not synced across accounts):

| Key                           | Stores                           |
| ----------------------------- | -------------------------------- |
| `mre_favourite_tracks`        | Favourite track IDs              |
| `mre_last_track`              | Last committed track             |
| `mre_date_range_preset`       | Date preset enum                 |
| `mre_last_date_range`         | Custom start/end when applicable |
| `mre_use_date_filter`         | Legacy date-filter flag          |
| `mre_event_search_pagination` | Page size and page index         |
| `mre_known_imported_events`   | Client hint for import UX        |

---

## Tips

- Type an **event name** in the omnibox to jump straight to analysis when it is
  already imported.
- Use **cross-track browse** (empty omnibox, LiveRC off) to scan the full MRE
  catalogue without picking a track first.
- Turn **Include Scheduled** off to hide future races from a busy club calendar.
- Turn **Include Ready** off when you only want to see events that still need
  importing.
- For keyword + session-type lookup, use [Global Search](global-search.md)
  instead.

---

## Related guides

| Guide                                         | Topic                                   |
| --------------------------------------------- | --------------------------------------- |
| [My Event Analysis (dashboard)](dashboard.md) | Modal entry, shortcuts, Redux selection |
| [Global Search](global-search.md)             | `/search` keyword flow                  |
| [Event Analysis](event-analysis.md)           | After you **Open** an event             |
| [Navigation](navigation.md)                   | Rail and Actions menu                   |
| [Troubleshooting](troubleshooting.md)         | Import stalls and spinner triage        |
