---
created: 2026-04-12
owner: Frontend / Platform
lastModified: 2026-04-13
description:
  Per-user host track selection for event analysis (LiveRC venue vs physical
  track)
purpose:
  Define the problem, UX intent, replacement for fully deprecated venue
  correction, data model, APIs, and relationship to car taxonomy user rules.
relatedFiles:
  - docs/architecture/venue-correction-deprecation.md (full deprecation policy)
  - prisma/schema.prisma (Track, Event; venue correction tables removed when
    migrated)
  - src/core/events/get-event-analysis-data.ts
  - src/core/events/venue-correction.ts (to be removed per
    venue-correction-deprecation.md)
  - src/components/organisms/event-analysis/OverviewTab.tsx
  - src/components/organisms/event-analysis/EventAnalysisActionsMenu.tsx
  - src/components/organisms/event-analysis/CarTaxonomyModal.tsx
  - docs/architecture/car-taxonomy-user-mapping.md
---

# Event host track (per-user override)

## Problem

LiveRC associates each **event** with a **`Track`** row (`events.track_id`).
That association reflects **what LiveRC exposes on the event page**, not a typed
distinction between “organiser / club office” and “physical track where racing
occurred.” The linked row may be the promoting body’s **office** contact and
location (mailing address, club web, email) while the race was held at a
**different** facility that also exists in MRE’s synced `tracks` catalogue.

**Concrete example (illustrative):** For an event such as **“2026 RCRA
Nationals”**, `event.track` may resolve to the **RCRA** club row (e.g. Brisbane,
Australia, `source_track_slug` such as `rcra`) because that is what LiveRC ties
to the event listing—**organiser metadata**, not necessarily the host venue.
Another event on the same weekend might correctly point at **“Canberra Off Road
Model Car Club”** if LiveRC linked that track id. Users need a way to record
**which catalogue track was the actual host** for their own analysis, without
pretending ingestion can infer it from LiveRC alone.

MRE should let an **authenticated user** record **which catalogue track they
consider the real host** for **this event**, for **their own** analysis view,
without rewriting ingestion or other users’ data.

## Product intent

| Surface                         | Behavior                                                                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Venue info** (existing block) | Reflects **LiveRC-linked** venue data: the **`Track`** row attached to the event via **`events.track_id`** after ingestion (`formatTrackAddress` / contact fields as today). This is **honest** about what the feed provides, including organiser-style rows when that is all LiveRC offers. |
| **Host track** (new block)      | Shown **only** when the **current user** has saved a **per-user host track** for this event. Displays address/contact-style fields from the chosen **`Track`** row (same presentation family as venue info).                                                                                 |
| **Actions**                     | **“Update Host Track”** opens a **modal** patterned after **Car type mapping** (`CarTaxonomyModal` + shared `Modal` shell): search/select a catalogue track, preview its details, confirm or clear.                                                                                          |

This is **analogous in spirit** to
[car taxonomy user mapping](./car-taxonomy-user-mapping.md): **user-scoped**
preferences that refine analysis UX. Unlike car rules (global patterns per
user), host track is **scoped to `(user_id, event_id)`**.

## Replacement for deprecated venue correction (all flows)

The previous **admin-moderated venue correction** system (`EventVenueCorrection`
/ `EventVenueCorrectionRequest`, user APIs, admin APIs, moderation UI, and
server overrides for venue/weather) is **fully deprecated**. See
**[venue-correction-deprecation.md](./venue-correction-deprecation.md)** for
policy and removal checklist.

That model required moderation and a **single global** `venue_track_id` per
event. **Update Host Track** replaces it: users pick a **catalogue `Track`** for
**personal** analysis only—no admin workflow, no shared canonical override.

| Mechanism                          | Status                  | Scope                          | Who sees it                             |
| ---------------------------------- | ----------------------- | ------------------------------ | --------------------------------------- |
| **Venue correction** (old)         | **Deprecated — remove** | One row per event              | Was global effective venue              |
| **User host track** (this feature) | **Current**             | One row per **user** per event | **That user** only (dedicated UI block) |

**Precedence (normative for v1):**

1. **Venue info** uses **`event.track`** (LiveRC-linked row) for display.
   **Venue correction overrides must not** apply once removed from code.
2. **User host track** is an **additional** section driven only by
   **`UserEventHostTrack`** (or equivalent). It does **not** by itself replace
   weather unless a future ADR wires personal host into those systems.

## Data model (proposed)

Introduce a dedicated table, for example:

| Column                      | Type          | Notes                                       |
| --------------------------- | ------------- | ------------------------------------------- |
| `id`                        | UUID PK       |                                             |
| `user_id`                   | FK → `users`  |                                             |
| `event_id`                  | FK → `events` |                                             |
| `host_track_id`             | FK → `tracks` | Catalogue track the user designates as host |
| `created_at` / `updated_at` | timestamps    |                                             |

**Constraints:** `@@unique([user_id, event_id])` so each user has at most one
host pick per event.

**Cascade:** On user or event delete, cascade or set-null per existing Prisma
conventions for similar join tables (`UserCarTaxonomyRule`, `EventDriverLink`).

**Naming:** Prefer a clear model name such as `UserEventHostTrack` mapped to
`user_event_host_tracks`.

## Server payload

Extend **`getEventAnalysisData`** (when called with `userId`) to include
optional:

- `userHostTrack`: `null` | `{ trackId, trackName, address fields..., … }`
  resolved from `host_track_id` → `Track` (reuse the same formatting helpers as
  venue lines where practical — see
  [address-normalization.md](./address-normalization.md)).

The client renders **Host track** only when `userHostTrack` is non-null.

## HTTP API (proposed)

Authenticated routes under a stable prefix, for example:

| Method   | Path                                       | Purpose                                                               |
| -------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `GET`    | `/api/v1/user/events/[eventId]/host-track` | Read current user’s override (404 or `{ hostTrack: null }` if unset). |
| `PUT`    | `/api/v1/user/events/[eventId]/host-track` | Set `{ hostTrackId }` (validate FK to `tracks`).                      |
| `DELETE` | `/api/v1/user/events/[eventId]/host-track` | Clear override.                                                       |

**Authorization:** Prefer **any authenticated user** who can open event analysis
for that event (unless product explicitly restricts to event-linked users).
Venue-correction eligibility rules **do not** apply—those APIs are deprecated.

**Track search for the modal:** Today, **`GET /api/v1/admin/tracks`** is
**admin-only**. The modal needs a **non-admin** way to search/list catalogue
tracks (e.g. new `GET /api/v1/tracks/search?q=&limit=` with rate limiting and
scoped fields). Define this endpoint as part of the implementation plan.

## UI components

- **`EventAnalysisActionsMenu`** (or adjacent actions strip): menu item **Update
  Host Track**.
- **New modal** (e.g. `HostTrackModal.tsx`): layout parity with
  `CarTaxonomyModal` — `Modal` wrapper, scroll regions, optional drag header,
  search input, result list, detail preview, primary **Save** / **Clear**.
- **`OverviewTab`**: second collapsible section **Host track** (same structural
  pattern as **Venue info**), gated on `userHostTrack`.

## Testing

- **Unit / integration:** core CRUD for `UserEventHostTrack`; API route tests
  (auth, 404, validation).
- **Optional:** snapshot or RTL test for Overview when `userHostTrack` is
  present vs absent.

## References

- Car taxonomy rules:
  [car-taxonomy-user-mapping.md](./car-taxonomy-user-mapping.md)
- Address display: [address-normalization.md](./address-normalization.md)
- Deprecation policy:
  [venue-correction-deprecation.md](./venue-correction-deprecation.md)
- Effective venue / analysis payload:
  `src/core/events/get-event-analysis-data.ts`
