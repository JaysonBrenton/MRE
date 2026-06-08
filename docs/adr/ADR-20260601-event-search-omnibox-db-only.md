---
created: 2026-06-01
lastModified: 2026-06-01
status: Accepted
deciders: Frontend Delivery, Product
---

# ADR-20260601 — Dashboard Event Search omnibox + collapsed Filters

> **Update (2026-06-01):** Scope corrected. The **omnibox type-ahead** is
> database-only, but the **full search retains LiveRC discovery** via the Search
> LiveRC toggle (now inside the Filters popover). All previously shipped filters
> — Track Selection, Date Filter, Search LiveRC, Search Everlaps, Include
> practice days — remain available; they are collapsed behind Filters, not
> removed.

## Context

The dashboard **Event Search** modal (`EventSearchModal` →
`EventSearchContainer` → `EventSearchForm`) currently presents a **track-first,
multi-control** form. Before a user sees any results they must:

1. Open a **Track Selection** modal and pick a track.
2. Optionally open a **Date Filter** modal.
3. Reason about three toggles — **Search LiveRC**, **Search Everlaps**, and
   **Include practice days** — that are shown inline at all times.
4. Click **Search**.

This imposes high cognitive load for the common task ("find the event I already
have") and, critically, **only supports searching by track name**. Users cannot
type an event name and jump to it.

Separately, the inline **Search LiveRC** toggle blurs the line between
_searching_ (recall something already ingested) and _importing_ (fetch new data
from LiveRC). Importing already has a dedicated home — **Actions → Find and
Import Events** and the dashboard **Event Search** modal (see
[event-search user guide](../user-guides/event-search.md)).

## Decision

1. **Add a Google-style omnibox** at the top of the modal: a single debounced
   type-ahead input that matches **track names** and **event names** from the
   database and presents grouped look-ahead suggestions.
   - Selecting a **track** suggestion runs the existing track-scoped search
     (honouring the current filter/source toggles).
   - Selecting an **event** suggestion selects that event for the dashboard
     (same effect as picking it from the results list).
   - The **type-ahead suggestions themselves are database-only** — they never
     call LiveRC, so the dropdown stays fast.

2. **Collapse all secondary controls behind a "Filters" button.** Track
   Selection, Date Filter, **Search LiveRC**, **Search Everlaps**, and Include
   practice days move into a single **Filters** popover (icon + label, with a
   badge when non-default filters are active). The primary surface is the
   omnibox plus a Search action.

3. **Preserve existing search behaviour.** The full search (Search button /
   selecting a track) keeps all prior behaviour, including **LiveRC discovery
   when Search LiveRC is on** (select a track, toggle on → DB **and** LiveRC
   events returned). No search/import behaviour is removed.

4. **New suggestion API.** Add `GET /api/v1/events/search/suggest?q=&limit=`
   returning `{ tracks, events }`. It is **DB-only**, authenticated, capped, and
   excludes synthetic practice-day rows. Event suggestions are restricted to
   events with ingested content (`ingest_depth != none`) so every suggestion is
   actionable.

## Consequences

- **Lower cognitive load:** one obvious input; advanced controls are one click
  away rather than always-on.
- **New capability:** search by event name, not just track name.
- **No loss of capability:** Search LiveRC, Search Everlaps, Date Filter, and
  Include practice days all remain — relocated into the Filters popover.
- **Backend addition:** a new suggest endpoint and core/repo functions; relies
  on existing indexes on `events.event_name` (via `track_id, event_date`) and
  `tracks.track_name`. Trigram indexing can be revisited if `ILIKE '%term%'`
  latency becomes a problem.
- **Behavioural change:** the always-visible control row becomes a Filters
  popover; the omnibox is new. The keyboard shortcut (⌘E), full-search LiveRC
  discovery, import flow, and dashboard event selection are unchanged.

## References

- Normative spec:
  [event-search-omnibox.md](../architecture/event-search-omnibox.md)
- Implementation plan:
  [event-search-omnibox-2026-06.md](../implimentation_plans/event-search-omnibox-2026-06.md)
- Shipped Global Search (separate `/search` page):
  [search-feature.md](../architecture/search-feature.md)
