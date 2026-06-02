---
created: 2026-06-01
owner: Frontend Delivery
lastModified: 2026-06-01
purpose:
  Phased implementation plan for the database-only Event Search omnibox and the
  collapsed Filters control, as specified in
  docs/architecture/event-search-omnibox.md.
relatedDocs:
  - docs/architecture/event-search-omnibox.md
  - docs/adr/ADR-20260601-event-search-omnibox-db-only.md
  - docs/architecture/search-feature.md
  - docs/AGENTS.md
---

# Event Search omnibox — implementation plan (June 2026)

Implements [event-search-omnibox.md](../architecture/event-search-omnibox.md).
All runtime verification is **Docker-only** per [AGENTS.md](../AGENTS.md)
(`docker exec -it mre-app npm test`).

**Status:** In progress.

---

## Phase 0 — Decisions (locked)

- [x] Event Search is **database-only**; remove Search LiveRC + Search Everlaps
      from this surface. Import stays in Find and Import Events.
- [x] Omnibox matches **track names** and **event names**.
- [x] Event suggestions exclude practice-day synthetic rows and
      `ingest_depth = none` placeholders.
- [x] Secondary controls collapse into a **Filters** popover.

---

## Phase 1 — Suggestion API (DB-only)

- [x] `src/core/events/repo.ts`: add `suggestTracksByText` and
      `suggestEventsByText` Prisma queries (capped, filtered per spec §2.3).
- [x] `src/core/events/suggest-event-search.ts`: `suggestEventSearch(q, limit)`
      orchestrator returning `{ query, tracks, events }`; short-circuits when
      `q.trim().length < 2`.
- [x] `src/app/api/v1/events/search/suggest/route.ts`: authenticated GET, param
      parse/clamp, standardized `successResponse`, `no-store`.
- [x] Unit tests for core + route.

## Phase 2 — Omnibox component

- [x] `EventSearchOmnibox.tsx`: debounced fetch, min-length gating, grouped
      `combobox`/`listbox` rendering, keyboard nav, abort on re-query.
- [x] Emits `onSelectTrack(track)` and `onSelectEvent(eventId)`.
- [x] Component tests (debounce, grouping, keyboard, callbacks).

## Phase 3 — Filters popover

- [x] `EventSearchFilters.tsx`: "Filters" button + popover hosting Track
      Selection, Date Filter, Include practice days; active-filter badge;
      outside-click/Escape close.

## Phase 4 — Wire into form/container

- [x] `EventSearchForm.tsx`: render omnibox + Filters + Search/Stop; drop
      LiveRC/Everlaps toggles; pass through `onSelectEvent`.
- [x] `EventSearchContainer.tsx`: force `includeLiveRC`/`includeEverlaps` off,
      stop passing their change handlers, wire `onSelectEvent` to
      `onSelectForDashboard`.
- [x] Update empty-state copy to reference searching by track or event name.

## Phase 5 — Tests + docs

- [x] Run `npm test` in Docker; fix regressions in event-search tests.
- [x] Update user-facing docs (workflow + dashboard guide) and document index.

---

## Risk notes

- `EventSearchContainer` is large and owns import-status polling and run-id race
  guards. Keep those paths intact; only remove the LiveRC **toggle entry
  points** rather than the orchestration, leaving `includeLiveRC = false` so
  discovery is never triggered.
- Suggestion endpoint must never hit LiveRC; keep it purely Prisma-backed.
