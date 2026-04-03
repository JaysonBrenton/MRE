---
created: 2026-04-03
creator: Architecture (MRE)
lastModified: 2026-04-03
status: preliminary
description:
  Scoping and design for Everlaps as a secondary timing/event source when
  LiveRC-style track catalogs are not available upstream.
purpose:
  Define how MRE can surface Everlaps events to users in a track-like way using
  derived venues and event-driven indexing, without implying a shipped product
  commitment until prioritized.
relatedDocs:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/02-connector-architecture.md
  - docs/architecture/liverc-ingestion/23-ingestion-cross-connector-abstractions.md
  - docs/reference_material/Everlaps/notes.txt
---

# Everlaps ingestion — preliminary scoping and design

## 1. Executive summary

LiveRC ingestion is built around a **first-class track catalog**: tracks are
synced, users follow tracks, and events are discovered and grouped by track.
**Everlaps does not expose an equivalent global track registry** in the same
way; instead, **venue-like information is embedded on each event** (location
label, map link, organizer).

This document proposes a **preliminary** approach: treat Everlaps as an
**event-sourced** provider and materialize an internal **“derived venue”**
(Track-equivalent) from repeated event observations, so MRE can preserve a
**venue-first user experience** without pretending Everlaps has LiveRC’s
track-sync semantics.

**Status:** exploratory. No implementation is implied until product scope, legal
review, and engineering capacity are confirmed.

---

## 2. Problem statement

### 2.1 What works today (LiveRC)

- Ingest **tracks** as stable entities.
- Associate **events** with **track IDs**.
- Surface “my tracks”, search by track, and event lists per track.

### 2.2 What Everlaps offers instead

- Rich **event** payloads (schedule, venue text, map URL, organizer, classes,
  registrations).
- Public **JSON** access patterns used by the web apps (`POST` to
  `/api/frontend/event/{id}`, `POST` to `/api/res/...` for results), as observed
  in reference captures.
- **No** documented, versioned public API contract for third-party integrators.
- **No** obvious “list all venues” or “all events at venue X” endpoint
  equivalent to a track catalog.

### 2.3 Product requirement (MRE)

Users still need to **find events** and **anchor** them to a place they care
about (circuit, region, club). Without upstream tracks, MRE must **derive** that
anchor from event data.

---

## 3. Design goals

| Goal                     | Notes                                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| **Parity of UX concept** | Users can still “pick a place” and see related events.                     |
| **Honest data model**    | Distinguish **upstream track** (LiveRC) from **derived venue** (Everlaps). |
| **Incremental delivery** | MVP can index events + venues only; deep results later.                    |
| **Operational safety**   | Rate limits, backoff, idempotent upserts, observable jobs.                 |
| **Provider isolation**   | Connector remains stateless; pipeline owns persistence (same as LiveRC).   |

Non-goals for this document: exact SQL migrations, UI mocks, or CLI naming.

---

## 4. Conceptual solution: derived venues + event index

### 4.1 Derived venue (Track-equivalent)

A **DerivedVenue** (name TBD: `EverlapsVenue`, `ExternalVenue`) is created and
updated from Everlaps **event** records, not from a crawl of a track list.

**Primary signals (from event payload):**

- `location` — display name for the venue.
- `mapLink` — typically a Google Maps URL; **parse latitude/longitude** when
  present for stable deduplication.
- `organizer` / `organizerLink` — disambiguation when two events share a vague
  `location` string.

**Suggested identity rules (MVP):**

1. If **lat/lng** parsed from `mapLink`: key = rounded coordinate bucket or hash
   of (lat, lng) at reasonable precision (e.g. 5–6 decimals).
2. Else: fallback key = hash of **normalized** `location` + `organizer` (or
   organizer URL host).

**Stored fields (illustrative):**

- `provider` = `everlaps`
- `external_venue_key` (stable string)
- `display_name` (from `location`)
- `latitude`, `longitude` (nullable)
- `organizer_name`, `organizer_url`
- `first_seen_at`, `last_seen_at`
- `source_event_ids_sample` or count (for debugging, not necessarily full list
  at scale)

### 4.2 Event index

An **EverlapsEvent** record is upserted whenever sync pulls an event:

- Everlaps `eventId`, title, date range, registration window, categories,
  `resultsAvailable`, raw references needed for deep sync.

**Relationship:** each event row points to **one** `DerivedVenue` foreign key
(or nullable until first successful parse).

### 4.3 Discovery / sync strategy (event-driven)

Because there is no track catalog:

1. **Seed discovery** — periodic jobs pull Everlaps **event list** endpoints
   that the frontend uses (e.g. future and concluded event lists). Exact paths
   must be taken from the current Everlaps frontend bundles or server routes and
   treated as **volatile**.
2. **Fan-out** — for each discovered `eventId`, fetch
   `POST /api/frontend/event/{eventId}` and upsert event + derived venue.
3. **Refresh** — re-fetch known events on a TTL or when user opens the event in
   MRE (soft real-time).

**Outcome:** the set of **DerivedVenues** grows as MRE indexes more events. The
UI can list “venues we know about” — not “all venues on Earth.”

---

## 5. Results and lap data (optional layers)

Results are available via the separate **results** JSON surface (`POST`
`/api/res/...`), with hierarchical paths per class/session/heat. This is
**orthogonal** to venue derivation.

**Phasing suggestion:**

| Phase                   | Scope                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **A — Discovery**       | Event lists + frontend event payload + derived venues.                                          |
| **B — Results summary** | When `resultsAvailable`, store finals positions / points per class (no per-lap).                |
| **C — Full timing**     | Walk result tree; store heats and `lapgrid` / per-driver detail as needed for dashboard parity. |

Each phase increases **storage**, **API volume**, and **PII** handling; Phase C
requires explicit product justification.

---

## 6. UX mapping (LiveRC patterns → Everlaps)

| LiveRC idea          | Everlaps-backed behavior                                                           |
| -------------------- | ---------------------------------------------------------------------------------- |
| Browse tracks        | Browse **derived venues** (from indexed events).                                   |
| Follow a track       | Follow a **derived venue** (or follow **organizer** as a first-class alternative). |
| Events at a track    | Query events by `derived_venue_id`.                                                |
| Search by name       | Search `location`, organizer, event title, region (if enriched).                   |
| “Incomplete catalog” | Communicate that venue list is **built from events MRE has seen**.                 |

Optional: **dual follow** — user follows both a venue and an organizer club when
Everlaps makes the latter more stable than a raw location string.

---

## 7. Architecture placement (MRE)

Align with existing ingestion patterns:

- **`ingestion/connectors/everlaps/`** — pure HTTP + parse; returns typed DTOs;
  no DB writes.
- **Pipeline / jobs** — orchestrate list → detail → optional results; enforce
  rate limits and idempotency.
- **Cross-connector abstractions** — if MRE introduces a generic `ExternalVenue`
  or `ExternalEvent`, map both LiveRC tracks/events and Everlaps derived data
  into a **thin internal view model** for the app (see
  `docs/architecture/liverc-ingestion/23-ingestion-cross-connector-abstractions.md`).

**Important:** LiveRC **Track** rows and Everlaps **DerivedVenue** rows should
not be forced into one table without a deliberate merge strategy; prefer
**provider-specific tables** or a **polymorphic venue** with `source` enum.

---

## 8. Data protection and compliance (brief)

Everlaps payloads can include **personal data** (names, clubs, regions,
avatars). Any production design must include:

- lawful basis and retention policy;
- minimization (store only what the product needs);
- user-visible explanation if results are ingested.

Legal/commercial use of undocumented endpoints should be **reviewed** before
launch. This doc does not authorize production scraping.

---

## 9. Risks and mitigations

| Risk                                  | Mitigation                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| **Upstream route or payload changes** | Versioned connector tests; fixture replay; feature flags to disable Everlaps.    |
| **Venue dedupe errors**               | Prefer lat/lng; manual merge tool later; expose “report wrong venue” in UI.      |
| **High API volume**                   | Backoff, conditional requests where possible, cache ETags if Everlaps adds them. |
| **Duplicate product concepts**        | Name “Derived venue” in UI copy where confusion with LiveRC tracks matters.      |

---

## 10. Open questions

1. **Product:** Is Everlaps a first-class provider for v0.2+ or experimental?
2. **Legal / commercial:** Written permission or partnership with Everlaps?
3. **Identity:** Single global `ExternalVenue` vs provider-scoped tables?
4. **Search:** Do we need geocoding for events missing coordinates?
5. **Results:** Required for launch or post-MVP?
6. **Multi-region:** Everlaps locale parameter (`l=`) — default `en` vs user
   locale?

---

## 11. Suggested delivery phases (engineering)

1. **Spike complete** — document API observations + fixture dumps (see
   `docs/reference_material/Everlaps/`).
2. **Connector + dry-run CLI** — fetch lists and event detail; JSON stdout; no
   DB.
3. **Persist events + derived venues** — migrations; idempotent upsert job.
4. **App integration** — search and event detail; “venue” page backed by derived
   venue.
5. **Results** — Phases B/C as scoped.

---

## 12. References

- Internal notes: `docs/reference_material/Everlaps/notes.txt`
- Example full capture (single event):
  `docs/reference_material/Everlaps/event-3702-full-dump.json`
- LiveRC ingestion overview: `docs/architecture/liverc-ingestion/01-overview.md`
- Connector principles:
  `docs/architecture/liverc-ingestion/02-connector-architecture.md`
